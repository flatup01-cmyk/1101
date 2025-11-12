import crypto from 'crypto';
import fetch from 'node-fetch';
import admin from 'firebase-admin';
import { requireEnv } from './util.js';

if (!admin.apps.length) {
  admin.initializeApp();
}

const firestore = admin.firestore();
const serverTimestamp = admin.firestore.FieldValue.serverTimestamp;

const RETRY_DELAYS_MS = [5000, 15000, 45000];
const CACHE_COLLECTION = 'response_cache';
const CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;
const MAX_JA_CHARS = 180;
const MAX_EN_WORDS = 120;

const OVERLOAD_FALLBACK = {
  jp: '現在AIが混み合っています。しばらくしてから再試行してください。',
  en: 'The AI is overloaded. Please retry after a short wait.',
};

function createCacheKey(userId, conversationId, query) {
  return crypto.createHash('sha256').update(`text:${userId}:${conversationId ?? 'none'}:${query}`).digest('hex');
}

function truncateJapanese(text) {
  if (!text) return '';
  const chars = [...text];
  if (chars.length <= MAX_JA_CHARS) return text.trim();
  return chars.slice(0, MAX_JA_CHARS).join('').trim();
}

function truncateEnglish(text) {
  if (!text) return '';
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= MAX_EN_WORDS) return text.trim();
  return words.slice(0, MAX_EN_WORDS).join(' ').trim();
}

function buildFinalMessage(jaSummary, enSummary) {
  const jp = `別に長くは話さないわ。${jaSummary} 最後に一言。続けるなら、今日からね。`;
  const en = `Not overexplaining. ${enSummary} One last thing: progress comes from consistency—start today.`;
  return `${jp}\n\n${en}`;
}

async function getCachedResponse(cacheKey) {
  try {
    const doc = await firestore.collection(CACHE_COLLECTION).doc(cacheKey).get();
    if (!doc.exists) return null;
    const data = doc.data();
    const expiresAt = data.expires_at;
    if (!expiresAt || expiresAt.toMillis() < Date.now()) {
      await firestore.collection(CACHE_COLLECTION).doc(cacheKey).delete().catch(() => {});
      return null;
    }
    return data.payload ?? null;
  } catch (error) {
    console.error('テキストキャッシュ取得エラー:', error);
    return null;
  }
}

async function saveCachedResponse(cacheKey, payload) {
  try {
    const expiresAt = admin.firestore.Timestamp.fromMillis(
      Date.now() + CACHE_TTL_SECONDS * 1000,
    );
    await firestore.collection(CACHE_COLLECTION).doc(cacheKey).set(
      {
        payload,
        expires_at: expiresAt,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      },
      { merge: true },
    );
  } catch (error) {
    console.error('テキストキャッシュ保存エラー:', error);
  }
}

export async function chatWithDify({ query, userId, conversationId }) {
  if (!query) {
    throw new Error('query is required for chatWithDify');
  }

  const apiKey = requireEnv('DIFY_API_KEY');
  const cacheKey = createCacheKey(userId, conversationId, query);

  const cached = await getCachedResponse(cacheKey);
  if (cached && cached.finalMessage) {
    return {
      answer: cached.finalMessage,
      conversation_id: cached.conversationId ?? conversationId ?? null,
      cache_hit: true,
    };
  }

  const requestBody = {
    query: [
      'あなたは無料枠向けの軽量キャラクターAIです。',
      '以下のユーザー入力に対して短い二言語応答を作成してください。',
      '必ず次のJSON形式のみで回答してください:',
      '{',
      '  "ja_summary": "<日本語最大180文字。簡潔ツンデレ口調。箇条書きは最大3。外部リンク禁止。>",',
      '  "en_summary": "<English up to 120 words with concise tsundere tone. Up to 3 bullet points. No external links.>"',
      '}',
      'ユーザー入力:',
      query,
    ].join('\n'),
    inputs: {
      source: 'line',
      response_constraints: {
        ja_max_chars: MAX_JA_CHARS,
        en_max_words: MAX_EN_WORDS,
      },
    },
    response_mode: 'blocking',
    user: userId,
    conversation_id: conversationId ?? '',
  };

  console.info('Dify Chat APIリクエスト:', JSON.stringify({
    url: 'https://api.dify.ai/v1/chat-messages',
    method: 'POST',
    userId,
    conversationId: conversationId ?? null,
    cacheKey,
  }));

  let lastError = null;
  let json = null;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const res = await fetch('https://api.dify.ai/v1/chat-messages', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (res.ok) {
        json = await res.json();
        break;
      }

      const errorBody = await res.text();
      let errorJson = null;
      try {
        errorJson = JSON.parse(errorBody);
      } catch {
        // ignore
      }

      const status = res.status;
      const lowerMessage = (errorJson?.message || errorBody || '').toLowerCase();
      const isOverloaded =
        status === 429 ||
        status === 503 ||
        (typeof errorJson?.status === 'string' && errorJson.status.toUpperCase() === 'UNAVAILABLE') ||
        lowerMessage.includes('overload');

      lastError = new Error(`Dify chat error ${status} ${res.statusText}: ${errorBody}`);

      if (attempt < RETRY_DELAYS_MS.length && isOverloaded) {
        const delay = RETRY_DELAYS_MS[attempt];
        console.warn(`Difyチャットをリトライします（attempt=${attempt + 1}, delay=${delay}ms）`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      throw lastError;
    } catch (error) {
      lastError = error;
      if (attempt < RETRY_DELAYS_MS.length) {
        const delay = RETRY_DELAYS_MS[attempt];
        console.warn(`Difyチャット通信エラーのためリトライします（delay=${delay}ms）`, error.message);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }

  if (!json) {
    if (lastError) throw lastError;
    throw new Error('Difyチャット応答を取得できませんでした');
  }

  const rawAnswer = typeof json.answer === 'string' ? json.answer.trim() : '';

  let jaSummary = '';
  let enSummary = '';
  try {
    const parsed = rawAnswer ? JSON.parse(rawAnswer) : null;
    if (parsed && typeof parsed === 'object') {
      if (typeof parsed.ja_summary === 'string') {
        jaSummary = parsed.ja_summary;
      }
      if (typeof parsed.en_summary === 'string') {
        enSummary = parsed.en_summary;
      }
    }
  } catch (error) {
    console.error('テキスト応答JSON解析に失敗しました:', {
      error: error.message,
      rawAnswer,
    });
  }

  if (!jaSummary) {
    jaSummary = OVERLOAD_FALLBACK.jp;
  }
  if (!enSummary) {
    enSummary = OVERLOAD_FALLBACK.en;
  }

  jaSummary = truncateJapanese(jaSummary);
  enSummary = truncateEnglish(enSummary);

  const finalMessage = buildFinalMessage(jaSummary, enSummary);
  const convId = json.conversation_id ?? conversationId ?? null;

  await saveCachedResponse(cacheKey, {
    finalMessage,
    conversationId: convId,
  });

  return {
    answer: finalMessage,
    conversation_id: convId,
  };
}
