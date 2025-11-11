import fetch from 'node-fetch';
import admin from 'firebase-admin';
import { analyzeVideoBlocking, handleTextMessage, addEnglishTranslation } from './dify.js';
import { analyzeVideoStreaming } from './dify_streaming.js';
import { buildFallbackAnswer, requireEnv } from './util.js';

/**
 * Translate Japanese text to English using Dify API.
 * @param {string} japaneseText
 * @returns {Promise<string | null>}
 */
async function translateToEnglish(japaneseText) {
  try {
    const apiKey = requireEnv('DIFY_API_KEY');
    
    // Dify APIで英語翻訳を取得
    // 注意: これは簡易実装です。実際にはDifyのワークフローで
    // 日本語と英語の両方を返すように設定することを推奨します
    const requestBody = {
      query: `以下の日本語のテキストを英語に翻訳してください。翻訳のみを返してください:\n\n${japaneseText}`,
      inputs: { source: 'line' },
      response_mode: 'blocking',
      user: 'system',
    };

    const res = await fetch('https://api.dify.ai/v1/chat-messages', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
      console.error('英語翻訳APIエラー:', res.status, res.statusText);
      return null;
    }

    const json = await res.json();
    return typeof json.answer === 'string' && json.answer.trim().length
      ? json.answer.trim()
      : null;
  } catch (error) {
    console.error('英語翻訳エラー:', error);
    return null;
  }
}

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
async function updateJobDocument(jobId, payload) {
  if (!jobId) return;

  const docRef = firestore.doc(`video_jobs/${jobId}`);
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

<<<<<<< Current (Your changes)
  // Update conversation ID in users collection for conversation continuity
  if (effectiveConversationId) {
    await updateConversationId(lineUserId, effectiveConversationId);
  }

  // Difyのプロンプトで日本語と英語の両方を返すようにしているので、
  // そのまま使用する。もし英語が含まれていない場合は追加の翻訳を試みる。
  let finalAnswer = answer;
  
  // 英語が含まれているかチェック（簡単なチェック）
  const hasEnglish = /[a-zA-Z]{3,}/.test(answer);
  if (!hasEnglish) {
    // 英語が含まれていない場合のみ、追加の翻訳を試みる
    try {
      console.info('英語が含まれていないため、追加の翻訳を試みます。');
      finalAnswer = await addEnglishTranslation(answer);
    } catch (error) {
      console.error('English translation failed, using Japanese only:', error);
      // Continue with Japanese only if translation fails
    }
=======
  // 日本語の後に英語も追加
  // Difyの結果が日本語の場合、英語の翻訳を追加
  let finalAnswer = answer;
  try {
    // 英語翻訳を追加（簡易版：Difyに英語も含めて返すようにプロンプトを調整するか、
    // または別のDify API呼び出しで翻訳を取得）
    // ここでは、Difyの結果に英語を追加するための処理を追加
    // 実際の実装では、Difyのプロンプトを調整して日本語と英語の両方を返すようにするか、
    // 別のAPI呼び出しで翻訳を取得する必要があります
    
    // 簡易実装：Difyの結果に英語を追加するための関数を呼び出す
    const englishTranslation = await translateToEnglish(answer);
    if (englishTranslation) {
      finalAnswer = `${answer}\n\n--- English ---\n${englishTranslation}`;
    }
  } catch (error) {
    console.error('英語翻訳エラー:', error);
    // 翻訳エラーが発生しても、日本語の結果は送信する
    finalAnswer = answer;
>>>>>>> Incoming (Background Agent changes)
  }

  let lineError;
  try {
    await sendLineMessage(lineUserId, finalAnswer);
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
    answer: finalAnswer,
    conversation_id: effectiveConversationId,
    meta,
  };
}

/**
 * Get or create conversation ID for a user from Firestore.
 * @param {string} lineUserId LINE user ID
 * @returns {Promise<string | null>}
 */
async function getConversationId(lineUserId) {
  try {
    const userDoc = await firestore.doc(`users/${lineUserId}`).get();
    if (userDoc.exists) {
      const data = userDoc.data();
      return data.conversation_id || null;
    }
    return null;
  } catch (error) {
    console.error('Error getting conversation ID:', error);
    return null;
  }
}

/**
 * Update conversation ID for a user in Firestore.
 * @param {string} lineUserId LINE user ID
 * @param {string | null} conversationId
 */
async function updateConversationId(lineUserId, conversationId) {
  try {
    await firestore.doc(`users/${lineUserId}`).set(
      {
        conversation_id: conversationId,
        updated_at: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error('Error updating conversation ID:', error);
  }
}

/**
 * Handle text message from LINE user.
 * @param {Object} params
 * @param {string} params.lineUserId LINE user ID
 * @param {string} params.text User's text message
 * @returns {Promise<{answer: string, conversation_id: string | null}>}
 */
export async function handleTextMessageJob({ lineUserId, text }) {
  if (!lineUserId) {
    throw new Error('lineUserId is required');
  }
  if (!text || typeof text !== 'string') {
    throw new Error('text is required');
  }

  // Get existing conversation ID from Firestore
  const conversationId = await getConversationId(lineUserId);

  let difyResult;
  try {
    difyResult = await handleTextMessage({ query: text, userId: lineUserId, conversationId });
  } catch (error) {
    console.error('Dify text message error:', error);
    throw error;
  }

  const { answer, conversation_id: newConversationId } = difyResult;
  const effectiveConversationId = newConversationId ?? conversationId ?? null;

  // Update conversation ID in Firestore
  if (effectiveConversationId) {
    await updateConversationId(lineUserId, effectiveConversationId);
  }

  let lineError;
  try {
    await sendLineMessage(lineUserId, answer);
  } catch (error) {
    lineError = error;
    throw error;
  }

  return {
    answer,
    conversation_id: effectiveConversationId,
  };
}










