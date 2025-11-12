import crypto from 'crypto';
import fetch from 'node-fetch';
import admin from 'firebase-admin';
import { analyzeVideoBlocking } from './dify.js';
import { analyzeVideoStreaming } from './dify_streaming.js';
import { buildFallbackAnswer, requireEnv } from './util.js';

if (!admin.apps.length) {
  admin.initializeApp();
}

const firestore = admin.firestore();
const serverTimestamp = admin.firestore.FieldValue.serverTimestamp;

const CACHE_COLLECTION = 'response_cache';
const CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;
const MAX_JA_CHARS = 180;
const MAX_EN_WORDS = 120;

const OVERLOAD_FALLBACK = {
  jp: '現在AIが混み合っています。しばらくしてから再試行してください。',
  en: 'The AI is overloaded. Please retry after a short wait.',
};

function createHashKey(type, input) {
  return crypto.createHash('sha256').update(`${type}:${input}`).digest('hex');
}

function truncateJapanese(text, maxChars) {
  if (!text) return '';
  if ([...text].length <= maxChars) return text.trim();
  return [...text].slice(0, maxChars).join('').trim();
}

function truncateEnglishWords(text, maxWords) {
  if (!text) return '';
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text.trim();
  return words.slice(0, maxWords).join(' ').trim();
}

function buildFinalMessage(jaSummary, enSummary) {
  const jp = `別に長くは話さないわ。${jaSummary} 最後に一言。続けるなら、今日からね。`;
  const en = `Not overexplaining. ${enSummary} One last thing: progress comes from consistency—start today.`;
  return `${jp}\n\n${en}`;
}

async function getCachedResponse(cacheKey) {
  try {
    const docRef = firestore.collection(CACHE_COLLECTION).doc(cacheKey);
    const snapshot = await docRef.get();
    if (!snapshot.exists) return null;
    const data = snapshot.data();
    const expiresAt = data.expires_at;
    if (!expiresAt || expiresAt.toMillis() < Date.now()) {
      await docRef.delete().catch(() => {});
      return null;
    }
    return data.payload ?? null;
  } catch (error) {
    console.error('キャッシュ取得エラー:', error);
    return null;
  }
}

async function saveCachedResponse(cacheKey, payload) {
  try {
    const docRef = firestore.collection(CACHE_COLLECTION).doc(cacheKey);
    const expiresAt = admin.firestore.Timestamp.fromMillis(
      Date.now() + CACHE_TTL_SECONDS * 1000,
    );
    await docRef.set(
      {
        payload,
        expires_at: expiresAt,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      },
      { merge: true },
    );
  } catch (error) {
    console.error('キャッシュ保存エラー:', error);
  }
}

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

  const cacheKey = createHashKey('video', videoUrl);
  const cached = await getCachedResponse(cacheKey);
  if (cached && cached.finalMessage) {
    console.info('キャッシュから動画解析結果を返却します');
    let lineError;
    try {
      await sendLineMessage(lineUserId, cached.finalMessage);
    } catch (error) {
      lineError = error;
    }

    const jobPayload = {
      status: lineError ? 'line_failed' : 'completed_cached',
      conversation_id: cached.conversationId ?? null,
      dify_mode: selectStreaming ? 'streaming' : 'blocking',
      dify_meta: cached.meta ?? {},
      last_message: cached.finalMessage,
      cache_hit: true,
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
      answer: cached.finalMessage,
      conversation_id: cached.conversationId ?? null,
      meta: cached.meta ?? {},
      cache_hit: true,
    };
  }

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

  let jaSummary = '';
  let enSummary = '';

  try {
    const parsed = JSON.parse(answer);
    if (parsed && typeof parsed === 'object') {
      if (typeof parsed.ja_summary === 'string') {
        jaSummary = parsed.ja_summary;
      }
      if (typeof parsed.en_summary === 'string') {
        enSummary = parsed.en_summary;
      }
    }
  } catch (error) {
    console.error('Dify応答のJSON解析に失敗しました:', {
      error: error.message,
      answer,
    });
  }

  if (!jaSummary) {
    jaSummary = OVERLOAD_FALLBACK.jp;
  }
  if (!enSummary) {
    enSummary = OVERLOAD_FALLBACK.en;
  }

  jaSummary = truncateJapanese(jaSummary, MAX_JA_CHARS);
  enSummary = truncateEnglishWords(enSummary, MAX_EN_WORDS);

  const finalAnswer = buildFinalMessage(jaSummary, enSummary);

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
    last_message: finalAnswer,
    ...extraJobData,
  };

  if (lineError) {
    jobPayload.line_error = lineError.message;
  }

  await updateJobDocument(jobId, jobPayload);

  await saveCachedResponse(cacheKey, {
    finalMessage: finalAnswer,
    conversationId: effectiveConversationId,
    meta: meta ?? {},
  });

  if (lineError) {
    throw lineError;
  }

  return {
    answer: finalAnswer,
    conversation_id: effectiveConversationId,
    meta,
  };
}










