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


