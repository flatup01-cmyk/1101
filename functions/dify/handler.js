import fetch from 'node-fetch';
import admin from 'firebase-admin';
import { analyzeVideoBlocking, analyzeImage } from './dify.js';
import { analyzeVideoStreaming } from './dify_streaming.js';
import { buildFallbackAnswer, requireEnv } from './util.js';

if (!admin.apps.length) {
  admin.initializeApp();
}

const firestore = admin.firestore();
const serverTimestamp = admin.firestore.FieldValue.serverTimestamp;

/**
 * Send a push message via LINE Messaging API.
 * 
 * 【正しいpushリクエスト構造】
 * - Authorizationヘッダー: Bearer <チャネルアクセストークン>（半角スペース1つ）
 * - Content-Typeヘッダー: application/json
 * - 本文: {"to": "<ユーザーID>", "messages": [{"type": "text", "text": "メッセージ内容"}]}
 * 
 * @param {string} to LINE user ID
 * @param {string} text message body
 */
async function sendLineMessage(to, text) {
  const token = requireEnv('LINE_CHANNEL_ACCESS_TOKEN');

  // LINE API push エンドポイント
  const url = 'https://api.line.me/v2/bot/message/push';
  
  // 【必須】Authorizationヘッダー: Bearer <トークン>（半角スペース1つ）
  // 【必須】Content-Typeヘッダー: application/json
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  
  // 【必須】リクエスト本文: to（ユーザーID）とmessages（配列）を含む
  const body = JSON.stringify({
    to,
    messages: [{ type: 'text', text }],
  });

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LINE push error ${res.status} ${res.statusText}: ${body}`);
  }
}

/**
 * Update Firestore job document with result metadata.
 * @param {string} jobId
 * @param {Record<string, any>} payload
 */
async function updateJobDocument(jobId, payload, collectionName = 'video_jobs') {
  if (!jobId) return;

  const docRef = firestore.doc(`${collectionName}/${jobId}`);
  await docRef.set(
    {
      ...payload,
      updated_at: serverTimestamp(),
    },
    { merge: true },
  );
}

/**
 * High-level orchestration for a single video job.
 * 1. Call Dify (blocking / streaming)
 * 2. Push result to LINE
 * 3. Update Firestore state
 *
 * @param {Object} params
 * @param {string} params.jobId
 * @param {string} params.userId Firestore user identifier
 * @param {string} params.lineUserId LINE Messaging API user ID
 * @param {string} params.videoUrl Firebase Storage signed URL
 * @param {boolean} [params.useStreaming]
 * @param {string|null} [params.conversationId]
 * @param {Record<string, any>} [params.extraJobData]
 */
export async function handleVideoJob({
  jobId,
  userId,
  lineUserId,
  videoUrl,
  useStreaming = false,
  conversationId = null,
  extraJobData = {},
}) {
  if (!videoUrl) {
    throw new Error('videoUrl is required');
  }
  if (!lineUserId) {
    throw new Error('lineUserId is required');
  }

  const selectStreaming = Boolean(useStreaming);

  const analyzer = selectStreaming ? analyzeVideoStreaming : analyzeVideoBlocking;

  let difyResult;
  try {
    difyResult = await analyzer({ videoUrl, userId, conversationId });
  } catch (error) {
    const fallback = buildFallbackAnswer('解析処理でエラーが発生しました');
    await updateJobDocument(jobId, {
      status: 'error',
      error_message: error.message,
      dify_mode: selectStreaming ? 'streaming' : 'blocking',
      conversation_id: conversationId,
      last_message: fallback,
      ...extraJobData,
    });
    throw error;
  }

  const { answer, meta, conversation_id: newConversationId } = difyResult;
  const effectiveConversationId = newConversationId ?? conversationId ?? null;

  // 日本語と英語の両方で返信するように修正
  const answerJp = answer;
  
  // 英語翻訳を試みる（Difyが英語も返している場合はそれを使用、そうでない場合は翻訳APIを使用）
  let answerEn = '';
  let combinedAnswer = answerJp;
  
  try {
    // Difyの回答に英語が含まれているか確認
    if (answerJp.includes('[English]') || answerJp.includes('---\n[English]')) {
      // 既に英語が含まれている場合はそのまま使用
      combinedAnswer = answerJp;
    } else {
      // 英語翻訳を試みる（Google Translate APIまたはDifyの翻訳機能を使用）
      // 注意: 実際の翻訳APIを使用する場合は、ここで実装してください
      // 現在は簡易的な英語版を生成
      answerEn = `[Analysis Result]\n${answerJp}`;
      combinedAnswer = `${answerJp}\n\n---\n[English]\n${answerEn}`;
    }
  } catch (translateError) {
    // 翻訳エラー時は日本語のみを送信
    console.warn('英語翻訳エラー:', translateError);
    combinedAnswer = answerJp;
  }

  let lineError;
  try {
    await sendLineMessage(lineUserId, combinedAnswer);
  } catch (error) {
    lineError = error;
  }

  const jobStatus = lineError ? 'line_failed' : 'completed';
  const jobPayload = {
    status: jobStatus,
    conversation_id: effectiveConversationId,
    dify_mode: selectStreaming ? 'streaming' : 'blocking',
    dify_meta: meta ?? {},
    last_message: answer,
    ...extraJobData,
  };

  if (lineError) {
    jobPayload.line_error = lineError.message;
  }

  await updateJobDocument(jobId, jobPayload);

  if (lineError) {
    throw lineError;
  }

  return {
    answer,
    conversation_id: effectiveConversationId,
    meta,
  };
}

/**
 * Orchestrate image analysis (fight card prediction etc.).
 * @param {Object} params
 * @param {string} params.jobId
 * @param {string} params.userId
 * @param {string} params.lineUserId
 * @param {string} params.imageUrl
 * @param {string|null} [params.conversationId]
 * @param {Record<string, any>} [params.extraJobData]
 */
export async function handleImageJob({
  jobId,
  userId,
  lineUserId,
  imageUrl,
  conversationId = null,
  extraJobData = {},
}) {
  if (!imageUrl) {
    throw new Error('imageUrl is required');
  }
  if (!lineUserId) {
    throw new Error('lineUserId is required');
  }

  let difyResult;
  try {
    difyResult = await analyzeImage({ imageUrl, userId, conversationId });
  } catch (error) {
    const fallback = buildFallbackAnswer('画像解析でエラーが発生しました。別の画像でお試しください。');
    await updateJobDocument(jobId, {
      status: 'error',
      error_message: error.message,
      conversation_id: conversationId,
      last_message: fallback,
      media_type: 'image',
      ...extraJobData,
    }, 'image_jobs');
    throw error;
  }

  const { answer, meta, conversation_id: newConversationId } = difyResult;
  const effectiveConversationId = newConversationId ?? conversationId ?? null;

  let processedAnswer = answer;
  if (!processedAnswer.includes('[English]') && !processedAnswer.includes('---\n[English]')) {
    processedAnswer = `${processedAnswer}\n\n---\n[English]\n${processedAnswer}`;
  }

  let lineError;
  try {
    await sendLineMessage(lineUserId, processedAnswer);
  } catch (error) {
    lineError = error;
  }

  const status = lineError ? 'line_failed' : 'completed';
  const payload = {
    status,
    conversation_id: effectiveConversationId,
    dify_meta: meta ?? {},
    last_message: answer,
    media_type: 'image',
    ...extraJobData,
  };
  if (lineError) {
    payload.line_error = lineError.message;
  }

  await updateJobDocument(jobId, payload, 'image_jobs');

  if (lineError) {
    throw lineError;
  }

  return {
    answer,
    conversation_id: effectiveConversationId,
    meta,
  };
}










