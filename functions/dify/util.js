export function requireEnv(key, { allowEmpty = false, defaultValue = undefined } = {}) {
  const value = process.env[key];
  if (value === undefined || value === null || (!allowEmpty && value === '')) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Missing required environment variable: ${key}`);
  }
  if (typeof value !== 'string') {
    return value;
  }
  return value.trim();
}

/**
 * ヘッダー値をASCII文字のみに変換（node-fetchのERR_INVALID_CHARエラー対策）
 * @param {string} value - 変換する値
 * @returns {string} - ASCII文字のみを含む文字列
 */
export function sanitizeHeaderValue(value) {
  if (typeof value !== 'string') {
    throw new Error(`Header value must be a string, got ${typeof value}`);
  }
  // ASCII印字可能文字（0x20-0x7E）のみを保持
  // 制御文字、改行、非ASCII文字を除去
  return value
    .replace(/[\x00-\x1F\x7F-\xFF]/g, '') // 制御文字と非ASCII文字を除去
    .trim();
}

/**
 * APIキーを安全にヘッダー用に変換
 * @param {string} apiKey - APIキー
 * @returns {string} - 安全なAPIキー（ASCIIのみ）
 */
export function sanitizeApiKey(apiKey) {
  if (!apiKey || typeof apiKey !== 'string') {
    throw new Error('API key must be a non-empty string');
  }
  const sanitized = sanitizeHeaderValue(apiKey);
  if (!sanitized) {
    throw new Error('API key contains no valid ASCII characters');
  }
  return sanitized;
}

export function buildFallbackAnswer(japaneseMessage, englishMessage) {
  const jp = japaneseMessage?.trim() || '現在処理が混雑しています。しばらくしてから再度お試しください。';
  const en =
    englishMessage?.trim() ||
    'Processing is currently busy. Please wait a bit and try again.';
  return `${jp}\n\n--- Analysis Results (English) ---\n${en}`;
}

export function normalizeUsage(rawUsage) {
  if (!rawUsage || typeof rawUsage !== 'object') {
    return {};
  }

  const promptTokens =
    rawUsage.prompt_tokens ??
    rawUsage.promptTokens ??
    rawUsage['prompt-tokens'] ??
    null;
  const completionTokens =
    rawUsage.completion_tokens ??
    rawUsage.completionTokens ??
    rawUsage['completion-tokens'] ??
    null;
  const totalTokens =
    rawUsage.total_tokens ??
    rawUsage.totalTokens ??
    rawUsage['total-tokens'] ??
    (typeof promptTokens === 'number' && typeof completionTokens === 'number'
      ? promptTokens + completionTokens
      : null);

  const durationMs =
    rawUsage.duration_ms ??
    rawUsage.durationMs ??
    rawUsage['duration-ms'] ??
    null;

  const normalized = {};
  if (promptTokens !== null) normalized.promptTokens = promptTokens;
  if (completionTokens !== null) normalized.completionTokens = completionTokens;
  if (totalTokens !== null) normalized.totalTokens = totalTokens;
  if (durationMs !== null) normalized.durationMs = durationMs;

  for (const [key, value] of Object.entries(rawUsage)) {
    if (normalized[key] === undefined) {
      normalized[key] = value;
    }
  }

  return normalized;
}

