import fetch from 'node-fetch';
import { buildFallbackAnswer, normalizeUsage, requireEnv } from './util.js';

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
    query: 'この動画を解析し、要約と重要イベントを返してください。',
    inputs: { source: 'line' },
    response_mode: 'blocking',
    user: userId,
    conversation_id: conversationId ?? '',
    files: [{ type: 'video', transfer_method: 'remote_url', url: videoUrl }],
    auto_generate_name: true,
  };

  // Dify APIリクエストの詳細をログ出力（デバッグ用）
  console.info('Dify APIリクエスト:', JSON.stringify({
    url: 'https://api.dify.ai/v1/chat-messages',
    method: 'POST',
    videoUrl: videoUrl,
    userId: userId,
    conversationId: conversationId ?? null,
  }));

  const res = await fetch('https://api.dify.ai/v1/chat-messages', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    let errorMessage = `Dify blocking error ${res.status} ${res.statusText}`;
    let errorJson = null;
    try {
      errorJson = JSON.parse(errorBody);
      errorMessage += `: ${JSON.stringify(errorJson)}`;
    } catch {
      errorMessage += `: ${errorBody}`;
    }
    
    // 詳細なエラー情報をログ出力
    console.error('Dify APIエラー詳細:', JSON.stringify({
      status: res.status,
      statusText: res.statusText,
      errorBody: errorBody,
      errorJson: errorJson,
      videoUrl: videoUrl,
      requestHeaders: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ***',
      },
    }));
    
    // 500エラーの場合はフォールバックメッセージを返す
    if (res.status === 500) {
      console.error(`Dify API 500エラー: ${errorMessage}`);
      // エラーをスローせず、フォールバックメッセージを返す
      return {
        answer: buildFallbackAnswer('Dify APIで一時的なエラーが発生しました。しばらく待ってから再度お試しください。'),
        meta: {},
        conversation_id: conversationId ?? null,
      };
    }
    
    throw new Error(errorMessage);
  }

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


/**
 * Call Dify for image-based analysis (fight card prediction, etc.).
 * @param {{imageUrl: string, userId: string, conversationId?: string | null}} params
 * @returns {Promise<{answer: string, meta: Record<string, any>, conversation_id: string | null}>}
 */
export async function analyzeImage({ imageUrl, userId, conversationId }) {
  if (!imageUrl) {
    throw new Error('imageUrl is required for analyzeImage');
  }

  const apiKey = requireEnv('DIFY_API_KEY');

  const requestBody = {
    query: '添付した格闘技の試合カード画像を解析し、(1)カードの概要、(2)注目ポイント、(3)予想勝者と勝因、(4)警戒すべきリスク、(5)Flatupジムでできる準備メニュー、を日本語で詳しくまとめ、最後に---\\n[English]\\nの形で同内容を英語でも記載してください。',
    inputs: {
      source: 'line',
      task: 'fight_card_prediction',
    },
    response_mode: 'blocking',
    user: userId,
    conversation_id: conversationId ?? '',
    files: [{ type: 'image', transfer_method: 'remote_url', url: imageUrl }],
    auto_generate_name: true,
  };

  console.info('Dify Image APIリクエスト:', JSON.stringify({
    url: 'https://api.dify.ai/v1/chat-messages',
    method: 'POST',
    imageUrl,
    userId,
    conversationId: conversationId ?? null,
  }));

  const res = await fetch('https://api.dify.ai/v1/chat-messages', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    let errorMessage = `Dify image error ${res.status} ${res.statusText}`;
    try {
      const parsed = JSON.parse(errorBody);
      errorMessage += `: ${JSON.stringify(parsed)}`;
    } catch {
      errorMessage += `: ${errorBody}`;
    }
    console.error('Dify Image APIエラー:', errorMessage);
    throw new Error(errorMessage);
  }

  const json = await res.json();
  const baseMeta = json.metadata ?? {};
  const usage = baseMeta.usage ? normalizeUsage(baseMeta.usage) : undefined;
  const meta = usage ? { ...baseMeta, usage } : baseMeta;

  const answer = typeof json.answer === 'string' && json.answer.trim().length
    ? json.answer.trim()
    : buildFallbackAnswer('画像解析の結果が取得できませんでした。別の画像でお試しください。');

  const convId = json.conversation_id ?? conversationId ?? null;

  return { answer, meta, conversation_id: convId };
}


