import fetch from 'node-fetch';
import { buildFallbackAnswer, normalizeUsage, requireEnv } from './util.js';

const RETRY_DELAYS_MS = [5000, 15000, 45000];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isOverloadedError(status, errorJson, errorBody) {
  if (status === 429 || status === 503) {
    return true;
  }
  const message =
    (errorJson && (errorJson.message || errorJson.error || errorJson.detail)) ||
    errorBody ||
    '';
  return typeof message === 'string' && message.toLowerCase().includes('overload');
}

function shouldRetry(status, errorJson, errorBody) {
  if (status >= 500 || status === 429) {
    return true;
  }
  if (isOverloadedError(status, errorJson, errorBody)) {
    return true;
  }
  if (
    errorJson &&
    typeof errorJson.status === 'string' &&
    errorJson.status.toUpperCase() === 'UNAVAILABLE'
  ) {
    return true;
  }
  return false;
}

/**
 * Call Dify in blocking mode for shorter videos.
 * @param {{videoUrl: string, userId: string, conversationId?: string | null}} params
 * @returns {Promise<{answer: string, meta: Record<string, any>, conversation_id: string | null}>}
 */
export async function analyzeVideoBlocking({ videoUrl, userId, conversationId }) {
  if (!videoUrl) {
    throw new Error('videoUrl is required for analyzeVideoBlocking');
  }

  const apiKey = requireEnv('DIFY_API_KEY');

  const requestBody = {
    query: [
      'あなたは無料枠向けの軽量解析アシスタントです。',
      '入力動画の代表情報をもとに、日本語・英語の要約を短く生成してください。',
      '必ず次のJSONフォーマットで回答してください:',
      '{',
      '  "ja_summary": "<日本語最大180文字で要約と結論。口調は簡潔ツンデレ。箇条書きは最大3、外部リンク禁止>",',
      '  "en_summary": "<English summary within 120 words. Keep concise tsundere tone; at most 3 bullet points; no external links>"',
      '}',
      '文章以外は返さないでください。',
    ].join('\n'),
    inputs: {
      source: 'line',
      response_constraints: {
        ja_max_chars: 180,
        en_max_words: 120,
      },
    },
    response_mode: 'blocking',
    user: userId,
    conversation_id: conversationId ?? '',
    files: [{ type: 'video', transfer_method: 'remote_url', url: videoUrl }],
    auto_generate_name: true,
  };

  const requestPayload = JSON.stringify(requestBody);

  // Dify APIリクエストの詳細をログ出力（デバッグ用）
  console.info('Dify APIリクエスト:', JSON.stringify({
    url: 'https://api.dify.ai/v1/chat-messages',
    method: 'POST',
    videoUrl: videoUrl,
    userId: userId,
    conversationId: conversationId ?? null,
  }));

  let lastError = null;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    let res;
    let errorBody = '';
    let errorJson = null;
    try {
      res = await fetch('https://api.dify.ai/v1/chat-messages', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: requestPayload,
      });

      if (res.ok) {
        const json = await res.json();
        const baseMeta = json.metadata ?? {};
        const usage = baseMeta.usage ? normalizeUsage(baseMeta.usage) : undefined;
        const meta = usage ? { ...baseMeta, usage } : baseMeta;

        const answer = typeof json.answer === 'string' && json.answer.trim().length
          ? json.answer.trim()
          : buildFallbackAnswer('現在詳細取得に時間がかかっています');

        const convId = json.conversation_id ?? conversationId ?? null;

        return { answer, meta, conversation_id: convId };
      }

      errorBody = await res.text();
      let errorMessage = `Dify blocking error ${res.status} ${res.statusText}`;

      try {
        errorJson = JSON.parse(errorBody);
        errorMessage += `: ${JSON.stringify(errorJson)}`;
      } catch {
        errorMessage += `: ${errorBody}`;
      }

      console.error('Dify APIエラー詳細:', JSON.stringify({
        status: res.status,
        statusText: res.statusText,
        errorBody: errorBody,
        errorJson: errorJson,
        videoUrl: videoUrl,
        attempt: attempt + 1,
        requestHeaders: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ***',
        },
      }));

      if (isOverloadedError(res.status, errorJson, errorBody)) {
        lastError = new Error('Dify APIが混雑しています。');
      } else {
        lastError = new Error(errorMessage);
      }

      if (attempt < RETRY_DELAYS_MS.length && shouldRetry(res.status, errorJson, errorBody)) {
        const delay = RETRY_DELAYS_MS[attempt];
        console.warn(`Dify API呼び出しをリトライします（${attempt + 1}回目の失敗、${delay}ms待機）`);
        await sleep(delay);
        continue;
      }

      if (res.status === 500) {
        console.error(`Dify API 500エラー: ${errorMessage}`);
        return {
          answer: buildFallbackAnswer('Dify APIで一時的なエラーが発生しました。しばらく待ってから再度お試しください。'),
          meta: {},
          conversation_id: conversationId ?? null,
        };
      }

      if (isOverloadedError(res.status, errorJson, errorBody)) {
        console.error('Dify APIが過負荷状態のためフォールバックを返します');
        return {
          answer: buildFallbackAnswer('現在AIが大変混み合っています。少し時間をおいてから、再度お試しください。'),
          meta: { overloaded: true },
          conversation_id: conversationId ?? null,
        };
      }

      throw lastError;
    } catch (error) {
      if (error.name === 'FetchError' || error.code === 'ECONNRESET') {
        lastError = error;
        if (attempt < RETRY_DELAYS_MS.length) {
          const delay = RETRY_DELAYS_MS[attempt];
          console.warn(`Dify API通信エラーのためリトライします（${delay}ms待機）`, error.message);
          await sleep(delay);
          continue;
        }
      }
      throw error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error('Dify APIの呼び出しに失敗しました');
}


