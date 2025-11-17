import fetch from 'node-fetch';
import { buildFallbackAnswer, normalizeUsage, requireEnv, sanitizeApiKey } from './util.js';

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
  const safeApiKey = sanitizeApiKey(apiKey);
  const apiUrl = requireEnv('DIFY_API_URL', {
    defaultValue: 'https://api.dify.ai/v1/chat-messages',
  });

  const requestBody = {
    query: 'この動画を解析し、要約と重要イベントを日本語で返してください。解析結果の最後に、英語でサマリーも追加してください。\n\nPlease analyze this video and return a summary and important events in Japanese. Also add an English summary at the end of the analysis results.',
    inputs: { source: 'line' },
    response_mode: 'blocking',
    user: userId,
    conversation_id: conversationId ?? '',
    files: [{ type: 'video', transfer_method: 'remote_url', url: videoUrl }],
    auto_generate_name: true,
  };

  // Dify APIリクエストの詳細をログ出力（デバッグ用）
  console.info('Dify APIリクエスト:', JSON.stringify({
    url: apiUrl,
    method: 'POST',
    videoUrl: videoUrl,
    userId: userId,
    conversationId: conversationId ?? null,
  }));

  // 【診断ログ】ヘッダー直前のASCII検査
  const authHeader = `Bearer ${safeApiKey}`;
  const authHeaderIsAscii = /^[\x20-\x7E]*$/.test(authHeader);
  console.info(`🔍 [診断] Authorizationヘッダー検査: len=${authHeader.length}, asciiOnly=${authHeaderIsAscii}`);
  if (!authHeaderIsAscii) {
    const invalidChars = authHeader.split('').filter(c => !/[\x20-\x7E]/.test(c));
    console.error(`❌ [診断] Authorizationヘッダーに非ASCII文字検出: ${JSON.stringify(invalidChars)}`);
    throw new Error('Authorization header contains non-ASCII characters');
  }

  // ヘッダーを厳密にASCIIのみで構成（ERR_INVALID_CHARエラー対策）
  const headers = {
    'Authorization': authHeader,
    'Content-Type': 'application/json',
    'User-Agent': 'process-video-job/1.0',
  };

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: headers,
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
    console.error('❌ Dify Video APIエラー詳細:', JSON.stringify({
      status: res.status,
      statusText: res.statusText,
      errorBody: errorBody.substring(0, 500), // 最初の500文字のみ
      errorJson: errorJson,
      apiUrl: apiUrl,
      apiKeyLength: safeApiKey.length,
      apiKeyPrefix: safeApiKey.substring(0, 10) + '...',
      videoUrl: videoUrl.substring(0, 100) + '...',
    }));
    
    // 401エラー（認証エラー）の場合は、詳細な情報を出力してフォールバックメッセージを返す
    if (res.status === 401) {
      console.error('❌ Dify Video API 401認証エラー: Access tokenが無効です。');
      console.error(`   - API URL: ${apiUrl}`);
      console.error(`   - API Key 長さ: ${safeApiKey.length}`);
      console.error(`   - API Key 先頭10文字: ${safeApiKey.substring(0, 10)}...`);
      console.error(`   - エラーレスポンス: ${JSON.stringify(errorJson || errorBody.substring(0, 200))}`);
      // 401エラーは認証の問題なので、フォールバックメッセージを返す
      return {
        answer: buildFallbackAnswer('AIの認証エラーが発生しました。しばらく待ってから再度お試しください。'),
        meta: {},
        conversation_id: conversationId ?? null,
      };
    }
    
    // 500エラーの場合はフォールバックメッセージを返す
    if (res.status === 500) {
      console.error(`❌ Dify Video API 500エラー: ${errorMessage}`);
      // エラーをスローせず、フォールバックメッセージを返す
      return {
        answer: buildFallbackAnswer('Dify APIで一時的なエラーが発生しました。しばらく待ってから再度お試しください。'),
        meta: {},
        conversation_id: conversationId ?? null,
      };
    }
    
    // 400エラーの場合もフォールバックメッセージを返す（Dify APIの設定問題の可能性）
    if (res.status === 400) {
      console.error(`❌ Dify Video API 400エラー: ${errorMessage}`);
      return {
        answer: buildFallbackAnswer('動画解析でエラーが発生しました。動画形式を確認して再度お試しください。'),
        meta: {},
        conversation_id: conversationId ?? null,
      };
    }
    
    // その他のエラーもフォールバックメッセージを返す（エラーをスローしない）
    console.error(`❌ Dify Video API エラー (${res.status}): ${errorMessage}`);
    return {
      answer: buildFallbackAnswer('動画解析でエラーが発生しました。しばらく待ってから再度お試しください。'),
      meta: {},
      conversation_id: conversationId ?? null,
    };
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
  const safeApiKey = sanitizeApiKey(apiKey);
  const apiUrl = requireEnv('DIFY_API_URL', {
    defaultValue: 'https://api.dify.ai/v1/chat-messages',
  });

  const requestBody = {
    query: message,
    inputs: { source: 'line' },
    response_mode: 'blocking',
    user: userId,
    conversation_id: conversationId ?? '',
    auto_generate_name: true,
  };

  console.info('Dify Chat APIリクエスト:', JSON.stringify({
    url: apiUrl,
    method: 'POST',
    message: message.substring(0, 100),
    userId: userId,
    conversationId: conversationId ?? null,
  }));

  // 【診断ログ】ヘッダー直前のASCII検査
  const authHeader = `Bearer ${safeApiKey}`;
  const authHeaderIsAscii = /^[\x20-\x7E]*$/.test(authHeader);
  console.info(`🔍 [診断] Authorizationヘッダー検査: len=${authHeader.length}, asciiOnly=${authHeaderIsAscii}`);
  if (!authHeaderIsAscii) {
    const invalidChars = authHeader.split('').filter(c => !/[\x20-\x7E]/.test(c));
    console.error(`❌ [診断] Authorizationヘッダーに非ASCII文字検出: ${JSON.stringify(invalidChars)}`);
    throw new Error('Authorization header contains non-ASCII characters');
  }

  // ヘッダーを厳密にASCIIのみで構成（ERR_INVALID_CHARエラー対策）
  const headers = {
    'Authorization': authHeader,
    'Content-Type': 'application/json',
    'User-Agent': 'line-webhook-router/1.0',
  };

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: headers,
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
    
    console.error('❌ Dify Chat APIエラー詳細:', JSON.stringify({
      status: res.status,
      statusText: res.statusText,
      errorBody: errorBody.substring(0, 500),
      errorJson: errorJson,
      apiUrl: apiUrl,
      apiKeyLength: safeApiKey.length,
      apiKeyPrefix: safeApiKey.substring(0, 10) + '...',
    }));
    
    // 401エラー（認証エラー）の場合は、詳細な情報を出力
    if (res.status === 401) {
      console.error('❌ Dify Chat API 401認証エラー: Access tokenが無効です。');
      console.error(`   - API URL: ${apiUrl}`);
      console.error(`   - API Key 長さ: ${safeApiKey.length}`);
      console.error(`   - API Key 先頭10文字: ${safeApiKey.substring(0, 10)}...`);
      console.error(`   - エラーレスポンス: ${JSON.stringify(errorJson || errorBody.substring(0, 200))}`);
      // 401エラーは認証の問題なので、フォールバックメッセージを返す
      return {
        answer: 'すみません、AIの認証エラーが発生しました。しばらく待ってから再度お試しください。',
        meta: {},
        conversation_id: conversationId ?? null,
      };
    }
    
    // 500エラーの場合はフォールバックメッセージを返す
    if (res.status === 500) {
      console.error(`❌ Dify Chat API 500エラー: ${errorMessage}`);
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
 * Call Dify API for image analysis.
 * @param {{imageUrl: string, userId: string, conversationId?: string | null}} params
 * @returns {Promise<{answer: string, meta: Record<string, any>, conversation_id: string | null}>}
 */
export async function analyzeImage({ imageUrl, userId, conversationId }) {
  if (!imageUrl) {
    throw new Error('imageUrl is required for analyzeImage');
  }

  const apiKey = requireEnv('DIFY_API_KEY');
  const safeApiKey = sanitizeApiKey(apiKey);
  const apiUrl = requireEnv('DIFY_API_URL', {
    defaultValue: 'https://api.dify.ai/v1/chat-messages',
  });

  const requestBody = {
    query: 'この画像を解析し、日本語で結果を返してください。最後に英語サマリーも追加してください。\n\nPlease analyze this image and return the findings in Japanese, then append an English summary.',
    inputs: { source: 'line' },
    response_mode: 'blocking',
    user: userId,
    conversation_id: conversationId ?? '',
    files: [{ type: 'image', transfer_method: 'remote_url', url: imageUrl }],
    auto_generate_name: true,
  };

  console.info('Dify Image APIリクエスト:', JSON.stringify({
    url: apiUrl,
    method: 'POST',
    imageUrl: imageUrl,
    userId: userId,
    conversationId: conversationId ?? null,
  }));

  // 【診断ログ】ヘッダー直前のASCII検査
  const authHeader = `Bearer ${safeApiKey}`;
  const authHeaderIsAscii = /^[\x20-\x7E]*$/.test(authHeader);
  console.info(`🔍 [診断] Authorizationヘッダー検査: len=${authHeader.length}, asciiOnly=${authHeaderIsAscii}`);
  if (!authHeaderIsAscii) {
    const invalidChars = authHeader.split('').filter(c => !/[\x20-\x7E]/.test(c));
    console.error(`❌ [診断] Authorizationヘッダーに非ASCII文字検出: ${JSON.stringify(invalidChars)}`);
    throw new Error('Authorization header contains non-ASCII characters');
  }

  // ヘッダーを厳密にASCIIのみで構成（ERR_INVALID_CHARエラー対策）
  const headers = {
    'Authorization': authHeader,
    'Content-Type': 'application/json',
    'User-Agent': 'line-webhook-router/1.0',
  };

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    let errorMessage = `Dify image error ${res.status} ${res.statusText}`;
    let errorJson = null;
    try {
      errorJson = JSON.parse(errorBody);
      errorMessage += `: ${JSON.stringify(errorJson)}`;
    } catch {
      errorMessage += `: ${errorBody}`;
    }

    console.error('❌ Dify Image APIエラー詳細:', JSON.stringify({
      status: res.status,
      statusText: res.statusText,
      errorBody: errorBody.substring(0, 500),
      errorJson: errorJson,
      apiUrl: apiUrl,
      apiKeyLength: safeApiKey.length,
      apiKeyPrefix: safeApiKey.substring(0, 10) + '...',
      imageUrl: imageUrl.substring(0, 100) + '...',
    }));
    
    // 401エラー（認証エラー）の場合は、詳細な情報を出力
    if (res.status === 401) {
      console.error('❌ Dify Image API 401認証エラー: Access tokenが無効です。');
      console.error(`   - API URL: ${apiUrl}`);
      console.error(`   - API Key 長さ: ${safeApiKey.length}`);
      console.error(`   - API Key 先頭10文字: ${safeApiKey.substring(0, 10)}...`);
      console.error(`   - エラーレスポンス: ${JSON.stringify(errorJson || errorBody.substring(0, 200))}`);
      // 401エラーは認証の問題なので、エラーを投げずにフォールバックを返す
      throw new Error('Dify API authentication failed: Invalid access token');
    }

    if (res.status === 500) {
      console.error(`Dify Image API 500エラー: ${errorMessage}`);
      return {
        answer: buildFallbackAnswer('画像解析が混雑しています。しばらくしてから再度お試しください。'),
        meta: {},
        conversation_id: conversationId ?? null,
      };
    }

    if (res.status === 400) {
      console.error(`Dify Image API 400エラー: ${errorMessage}`);
      return {
        answer: buildFallbackAnswer('画像解析でエラーが発生しました。画像を確認して再度お試しください。'),
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

  let answer = '';
  if (Array.isArray(json.answer)) {
    answer = json.answer
      .map((item) => (typeof item === 'string' ? item : JSON.stringify(item)))
      .join('\n');
  } else if (typeof json.answer === 'string') {
    answer = json.answer.trim();
  } else if (json.text && typeof json.text === 'string') {
    answer = json.text.trim();
  } else {
    console.warn('Dify Image APIレスポンスにanswer/textフィールドが見つかりません:', JSON.stringify(json).substring(0, 200));
    answer = buildFallbackAnswer('現在詳細取得に時間がかかっています');
  }

  if (!answer || answer.length === 0) {
    answer = buildFallbackAnswer('現在詳細取得に時間がかかっています');
  }

  const convId = json.conversation_id ?? conversationId ?? null;
  return { answer, meta, conversation_id: convId };
}


