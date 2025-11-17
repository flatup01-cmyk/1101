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
    // タイムアウトを設定（5分 = 300秒）
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Video analysis timeout (5 minutes)')), 5 * 60 * 1000);
    });
    
    difyResult = await Promise.race([
      analyzer({ videoUrl, userId, conversationId }),
      timeoutPromise,
    ]);
  } catch (error) {
    console.error("❌ 動画解析処理でエラーが発生しました:", {
      error: error.message,
      stack: error.stack,
      videoUrl: videoUrl.substring(0, 100) + '...',
      userId: userId,
      errorName: error.name,
    });
    
    // エラーの種類に応じてメッセージを変更
    let errorMessage = '解析処理でエラーが発生しました。動画の形式を確認して再度お試しください。';
    if (error.message.includes('timeout')) {
      errorMessage = '動画解析がタイムアウトしました。動画が長すぎるか、サーバーが混雑している可能性があります。しばらく待ってから再度お試しください。';
    } else if (error.message.includes('401') || error.message.includes('authentication')) {
      errorMessage = 'AIの認証エラーが発生しました。しばらく待ってから再度お試しください。';
    } else if (error.message.includes('400')) {
      errorMessage = '動画形式が正しくない可能性があります。別の動画でお試しください。';
    }
    
    // ユーザーにエラーメッセージを送信（必ず送信する）
    const fallback = buildFallbackAnswer(errorMessage);
    try {
      await sendLineMessage(lineUserId, fallback);
      console.info("✅ ユーザーへエラーメッセージを送信しました");
    } catch (sendError) {
      console.error("❌ エラーメッセージの送信に失敗しました:", sendError.message);
      // エラーメッセージの送信に失敗しても、処理は継続する
    }
    
    // Firestoreにエラー状態を記録
    try {
      await updateJobDocument(jobId, {
        status: 'error',
        error_message: error.message,
        dify_mode: selectStreaming ? 'streaming' : 'blocking',
        conversation_id: conversationId,
        last_message: fallback,
        ...extraJobData,
      });
      console.info("✅ Firestoreにエラー状態を記録しました");
    } catch (firestoreError) {
      console.error("❌ Firestore更新に失敗しました:", firestoreError.message);
      // Firestore更新に失敗しても、処理は継続する
    }
    
    // エラーをスローせず、フォールバックメッセージを返す（必ず何らかの結果を返す）
    return {
      answer: fallback,
      meta: {},
      conversation_id: conversationId ?? null,
    };
  }

  const { answer, meta, conversation_id: newConversationId } = difyResult;
  const effectiveConversationId = newConversationId ?? conversationId ?? null;

  let fullMessage = answer;
  const alreadyHasEnglish =
    typeof answer === 'string' &&
    (answer.includes('[English]') ||
      /---\s*Analysis Results \(English\)/i.test(answer));

  if (!alreadyHasEnglish) {
    let englishSummary = '';
    try {
      const scoreMatches = answer.match(
        /(?:戦闘力|スコア|パンチ力|キック力|防御力|スタミナ|技術力|スピード|戦闘経験)[：:]\s*(\d+(?:\.\d+)?)/g
      );
      if (scoreMatches && scoreMatches.length > 0) {
        const scores = scoreMatches.map((match) => {
          const value = match.match(/(\d+(?:\.\d+)?)/);
          return value ? parseFloat(value[1]) : 0;
        });
        const avgScore =
          scores.reduce((a, b) => a + b, 0) / Math.max(scores.length, 1);

        englishSummary = `\n\n--- Analysis Results (English) ---\n`;
        englishSummary += `Average Score: ${avgScore.toFixed(1)}/100\n`;
        englishSummary += `(Scores extracted from analysis: ${scores.length} items)`;
      } else {
        englishSummary = `\n\n--- Analysis Results (English) ---\n`;
        englishSummary += `Video analysis completed successfully.\n`;
        englishSummary += `Please refer to the Japanese analysis above for detailed results.`;
      }
    } catch (error) {
      console.error('英語サマリー生成エラー:', error);
      englishSummary = `\n\n--- Analysis Results (English) ---\nVideo analysis completed.`;
    }

    fullMessage = answer + englishSummary;
  }

  let lineError;
  try {
    await sendLineMessage(lineUserId, fullMessage);
  } catch (error) {
    lineError = error;
  }

  const jobStatus = lineError ? 'line_failed' : 'completed';
  const jobPayload = {
    status: jobStatus,
    conversation_id: effectiveConversationId,
    dify_mode: selectStreaming ? 'streaming' : 'blocking',
    dify_meta: meta ?? {},
    last_message: fullMessage, // 英語サマリーを含む完全なメッセージ
    original_answer: answer, // 元のDify APIレスポンスも保存
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
    answer: fullMessage, // 英語サマリーを含む完全なメッセージを返す
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










