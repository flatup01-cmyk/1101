import fetch from 'node-fetch';
import { buildFallbackAnswer, normalizeUsage, requireEnv } from './util.js';

/**
 * Call Dify in streaming (SSE) mode to support longer videos.
 * @param {{videoUrl: string, userId: string, conversationId?: string | null}} params
 * @returns {Promise<{answer: string, meta: Record<string, any>, conversation_id: string | null}>}
 */
export async function analyzeVideoStreaming({ videoUrl, userId, conversationId }) {
  if (!videoUrl) {
    throw new Error('videoUrl is required for analyzeVideoStreaming');
  }

  const apiKey = requireEnv('DIFY_API_KEY');

  const res = await fetch('https://api.dify.ai/v1/chat-messages', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: 'この動画を解析し、要約と重要イベントを返してください。',
      inputs: { source: 'line' },
      response_mode: 'streaming',
      user: userId,
      conversation_id: conversationId ?? '',
      files: [{ type: 'video', transfer_method: 'remote_url', url: videoUrl }],
      auto_generate_name: true,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Dify streaming error ${res.status} ${res.statusText}: ${text}`);
  }

  const reader = res.body.getReader();
  let buffer = '';
  let finalAnswer = '';
  let finalMeta = {};
  let convId = conversationId ?? null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += Buffer.from(value).toString('utf8');
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';

    for (const part of parts) {
      for (const line of part.split('\n')) {
        if (!line.startsWith('data: ')) continue;

        try {
          const evt = JSON.parse(line.slice(6));

          if (evt.event === 'message' && evt.answer) {
            finalAnswer += evt.answer;
          }

          if (evt.event === 'message_end') {
            convId = evt.conversation_id ?? convId;
            const baseMeta = evt.metadata ?? {};
            const usage = baseMeta.usage ? normalizeUsage(baseMeta.usage) : undefined;
            finalMeta = usage ? { ...baseMeta, usage } : baseMeta;

            const answer = finalAnswer.trim().length
              ? finalAnswer.trim()
              : buildFallbackAnswer('現在詳細取得に時間がかかっています');

            return { answer, meta: finalMeta, conversation_id: convId };
          }

          if (evt.event === 'error') {
            throw new Error(`Dify SSE error ${evt.status ?? ''} ${evt.code ?? ''}: ${evt.message ?? 'unknown error'}`.trim());
          }
        } catch {
          // 無効な行は無視
        }
      }
    }
  }

  return {
    answer: buildFallbackAnswer('解析が完了しませんでした'),
    meta: finalMeta,
    conversation_id: convId,
  };
}


