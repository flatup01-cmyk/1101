import fetch from 'node-fetch';
import { requireEnv } from './util.js';

/**
 * Call Dify API for text conversation (chat).
 * @param {{query: string, userId: string, conversationId?: string | null}} params
 * @returns {Promise<{answer: string, conversation_id: string | null}>}
 */
export async function chatWithDify({ query, userId, conversationId }) {
  if (!query) {
    throw new Error('query is required for chatWithDify');
  }

  const apiKey = requireEnv('DIFY_API_KEY');

  const requestBody = {
    query: query,
    inputs: { source: 'line' },
    response_mode: 'blocking',
    user: userId,
    conversation_id: conversationId ?? '',
  };

  console.info('Dify Chat APIリクエスト:', JSON.stringify({
    url: 'https://api.dify.ai/v1/chat-messages',
    method: 'POST',
    query: query.substring(0, 100),
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
    let errorMessage = `Dify chat error ${res.status} ${res.statusText}`;
    try {
      const errorJson = JSON.parse(errorBody);
      errorMessage += `: ${JSON.stringify(errorJson)}`;
    } catch {
      errorMessage += `: ${errorBody}`;
    }
    
    console.error('Dify Chat APIエラー詳細:', JSON.stringify({
      status: res.status,
      statusText: res.statusText,
      errorBody: errorBody,
      query: query.substring(0, 100),
    }));
    
    throw new Error(errorMessage);
  }

  const json = await res.json();
  const answer = typeof json.answer === 'string' && json.answer.trim().length
    ? json.answer.trim()
    : 'すみません、もう一度お願いします。';

  const convId = json.conversation_id ?? conversationId ?? null;

  return { answer, conversation_id: convId };
}

