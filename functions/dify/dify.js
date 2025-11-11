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
<<<<<<< Current (Your changes)
<<<<<<< Current (Your changes)
<<<<<<< Current (Your changes)
<<<<<<< Current (Your changes)
    query: 'この動画を解析し、要約と重要イベントを日本語で返してください。その後、同じ内容を英語でも返してください。\n\n形式:\n[日本語の解析結果]\n\n[English translation of the analysis]',
=======
    query: 'この動画を解析し、要約と重要イベントを日本語と英語の両方で返してください。まず日本語で説明し、その後に英語で説明してください。\n\nAnalyze this video and return a summary and important events in both Japanese and English. First explain in Japanese, then explain in English.',
>>>>>>> Incoming (Background Agent changes)
=======
    query: 'この動画を解析し、要約と重要イベントを日本語で返してください。解析結果の最後に、英語でサマリーも追加してください。\n\nPlease analyze this video and return a summary and important events in Japanese. Also add an English summary at the end of the analysis results.',
>>>>>>> Incoming (Background Agent changes)
=======
    query: 'この動画を解析し、要約と重要イベントを日本語で返してください。その後、同じ内容を英語でも返してください。\n\n形式:\n[日本語の解析結果]\n\n[English translation of the analysis]',
>>>>>>> Incoming (Background Agent changes)
=======
    query: 'この動画を解析し、要約と重要イベントを日本語と英語の両方で返してください。まず日本語で説明し、その後に英語で説明してください。\n\nAnalyze this video and return a summary and important events in both Japanese and English. First explain in Japanese, then explain in English.',
>>>>>>> Incoming (Background Agent changes)
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
      
      // 400エラーの場合、より詳細なエラー情報をログ出力
      if (res.status === 400) {
        console.error('Dify API 400エラー詳細:', JSON.stringify({
          errorCode: errorJson.code,
          errorMessage: errorJson.message,
          videoUrl: videoUrl.substring(0, 100) + '...',
          userId: userId,
        }));
      }
    } catch {
      errorMessage += `: ${errorBody}`;
    }
    
    // 詳細なエラー情報をログ出力
    console.error('Dify APIエラー詳細:', JSON.stringify({
      status: res.status,
      statusText: res.statusText,
      errorBody: errorBody.substring(0, 500), // 最初の500文字のみ
      errorJson: errorJson,
      videoUrl: videoUrl.substring(0, 100) + '...',
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
    
    // 400エラーの場合もフォールバックメッセージを返す（Dify APIの設定問題の可能性）
    if (res.status === 400) {
      console.error(`Dify API 400エラー: ${errorMessage}`);
      return {
        answer: buildFallbackAnswer('動画解析でエラーが発生しました。動画形式を確認して再度お試しください。'),
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

  // レスポンスのanswerフィールドを安全に取得
  let answer = '';
  if (Array.isArray(json.answer)) {
    // 配列の場合は結合
    answer = json.answer.map(item => typeof item === 'string' ? item : JSON.stringify(item)).join('\n');
  } else if (typeof json.answer === 'string') {
    answer = json.answer.trim();
  } else if (json.text && typeof json.text === 'string') {
    // answerがない場合はtextフィールドを使用
    answer = json.text.trim();
  } else {
    // どちらもない場合はフォールバック
    console.warn('Dify APIレスポンスにanswer/textフィールドが見つかりません:', JSON.stringify(json).substring(0, 200));
    answer = buildFallbackAnswer('現在詳細取得に時間がかかっています');
  }

  if (!answer || answer.length === 0) {
    answer = buildFallbackAnswer('現在詳細取得に時間がかかっています');
  }

  const convId = json.conversation_id ?? conversationId ?? null;

  return { answer, meta, conversation_id: convId };
}


/**
 * Call Dify API for text conversation (no video).
 * @param {{message: string, userId: string, conversationId?: string | null}} params
 * @returns {Promise<{answer: string, meta: Record<string, any>, conversation_id: string | null}>}
 */
export async function chatWithDify({ message, userId, conversationId }) {
  if (!message) {
    throw new Error('message is required for chatWithDify');
  }

  const apiKey = requireEnv('DIFY_API_KEY');

  const requestBody = {
    query: message,
    inputs: { source: 'line' },
    response_mode: 'blocking',
    user: userId,
    conversation_id: conversationId ?? '',
    auto_generate_name: true,
  };

  console.info('Dify Chat APIリクエスト:', JSON.stringify({
    url: 'https://api.dify.ai/v1/chat-messages',
    method: 'POST',
    message: message.substring(0, 100),
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
    let errorJson = null;
    try {
      errorJson = JSON.parse(errorBody);
      errorMessage += `: ${JSON.stringify(errorJson)}`;
    } catch {
      errorMessage += `: ${errorBody}`;
    }
    
    console.error('Dify Chat APIエラー詳細:', JSON.stringify({
      status: res.status,
      statusText: res.statusText,
      errorBody: errorBody,
      errorJson: errorJson,
    }));
    
    // 500エラーの場合はフォールバックメッセージを返す
    if (res.status === 500) {
      console.error(`Dify Chat API 500エラー: ${errorMessage}`);
      return {
        answer: 'すみません、一時的なエラーが発生しました。しばらく待ってから再度お試しください。',
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
    : 'すみません、応答を生成できませんでした。もう一度お試しください。';

  const convId = json.conversation_id ?? conversationId ?? null;

  return { answer, meta, conversation_id: convId };
}

/**
 * Call Dify for text message conversation.
 * @param {{query: string, userId: string, conversationId?: string | null}} params
 * @returns {Promise<{answer: string, meta: Record<string, any>, conversation_id: string | null}>}
 */
export async function handleTextMessage({ query, userId, conversationId }) {
  if (!query) {
    throw new Error('query is required for handleTextMessage');
  }

  const apiKey = requireEnv('DIFY_API_KEY');

  const requestBody = {
    query: query,
    inputs: { source: 'line' },
    response_mode: 'blocking',
    user: userId,
    conversation_id: conversationId ?? '',
  };

  console.info('Dify API text message request:', JSON.stringify({
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
    let errorMessage = `Dify text message error ${res.status} ${res.statusText}`;
    let errorJson = null;
    try {
      errorJson = JSON.parse(errorBody);
      errorMessage += `: ${JSON.stringify(errorJson)}`;
    } catch {
      errorMessage += `: ${errorBody}`;
    }
    
    console.error('Dify API text message error:', JSON.stringify({
      status: res.status,
      statusText: res.statusText,
      errorBody: errorBody,
      errorJson: errorJson,
    }));
    
    if (res.status === 500) {
      console.error(`Dify API 500エラー: ${errorMessage}`);
      return {
        answer: '申し訳ございません。一時的なエラーが発生しました。しばらく待ってから再度お試しください。',
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
    : '申し訳ございません。現在応答を生成できませんでした。';

  const convId = json.conversation_id ?? conversationId ?? null;

  return { answer, meta, conversation_id: convId };
}

/**
 * Add English translation to Japanese text using Dify API.
 * @param {string} japaneseText
 * @returns {Promise<string>}
 */
export async function addEnglishTranslation(japaneseText) {
  if (!japaneseText || typeof japaneseText !== 'string') {
    return japaneseText;
  }

  try {
    const apiKey = requireEnv('DIFY_API_KEY');
    
    // Simple translation request - you may need to adjust this based on your Dify setup
    const requestBody = {
      query: `以下の日本語を英語に翻訳してください。翻訳のみを返してください:\n\n${japaneseText}`,
      inputs: { source: 'line' },
      response_mode: 'blocking',
      user: 'translation_bot',
    };

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒タイムアウト

    let res;
    try {
      res = await fetch('https://api.dify.ai/v1/chat-messages', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Translation request timeout');
      }
      throw error;
    }

    if (res.ok) {
      const json = await res.json();
      const englishText = typeof json.answer === 'string' && json.answer.trim().length
        ? json.answer.trim()
        : null;
      
      if (englishText) {
        return `${japaneseText}\n\n${englishText}`;
      }
    }
  } catch (error) {
    console.error('English translation error:', error);
    // 翻訳エラーが発生しても、元の日本語テキストを返す
  }

  return japaneseText;
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

/**
 * Call Dify for text message conversation.
 * @param {{query: string, userId: string, conversationId?: string | null}} params
 * @returns {Promise<{answer: string, meta: Record<string, any>, conversation_id: string | null}>}
 */
export async function handleTextMessage({ query, userId, conversationId }) {
  if (!query) {
    throw new Error('query is required for handleTextMessage');
  }

  const apiKey = requireEnv('DIFY_API_KEY');

  const requestBody = {
    query: query,
    inputs: { source: 'line' },
    response_mode: 'blocking',
    user: userId,
    conversation_id: conversationId ?? '',
  };

  console.info('Dify API text message request:', JSON.stringify({
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
    let errorMessage = `Dify text message error ${res.status} ${res.statusText}`;
    let errorJson = null;
    try {
      errorJson = JSON.parse(errorBody);
      errorMessage += `: ${JSON.stringify(errorJson)}`;
    } catch {
      errorMessage += `: ${errorBody}`;
    }
    
    console.error('Dify API text message error:', JSON.stringify({
      status: res.status,
      statusText: res.statusText,
      errorBody: errorBody,
      errorJson: errorJson,
    }));
    
    if (res.status === 500) {
      console.error(`Dify API 500エラー: ${errorMessage}`);
      return {
        answer: '申し訳ございません。一時的なエラーが発生しました。しばらく待ってから再度お試しください。',
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
    : '申し訳ございません。現在応答を生成できませんでした。';

  const convId = json.conversation_id ?? conversationId ?? null;

  return { answer, meta, conversation_id: convId };
}

/**
 * Add English translation to Japanese text using Dify API.
 * @param {string} japaneseText
 * @returns {Promise<string>}
 */
export async function addEnglishTranslation(japaneseText) {
  if (!japaneseText || typeof japaneseText !== 'string') {
    return japaneseText;
  }

  try {
    const apiKey = requireEnv('DIFY_API_KEY');
    
    // Simple translation request - you may need to adjust this based on your Dify setup
    const requestBody = {
      query: `以下の日本語を英語に翻訳してください。翻訳のみを返してください:\n\n${japaneseText}`,
      inputs: { source: 'line' },
      response_mode: 'blocking',
      user: 'translation_bot',
    };

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒タイムアウト

    let res;
    try {
      res = await fetch('https://api.dify.ai/v1/chat-messages', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Translation request timeout');
      }
      throw error;
    }

    if (res.ok) {
      const json = await res.json();
      const englishText = typeof json.answer === 'string' && json.answer.trim().length
        ? json.answer.trim()
        : null;
      
      if (englishText) {
        return `${japaneseText}\n\n${englishText}`;
      }
    }
  } catch (error) {
    console.error('English translation error:', error);
    // 翻訳エラーが発生しても、元の日本語テキストを返す
  }

  return japaneseText;
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


