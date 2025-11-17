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
  // 改行文字を除去（HTTPヘッダーでは改行は許可されていない）
  let cleaned = value.replace(/\r\n|\r|\n/g, '');
  
  // 制御文字（0x00-0x1F, 0x7F）と非ASCII文字（0x80-0xFF）を除去
  // ただし、引用符（"）やバックスラッシュ（\）は保持（APIキーには含まれないが、安全のため）
  cleaned = cleaned.replace(/[\x00-\x1F\x7F-\xFF]/g, '');
  
  // 先頭・末尾の空白を除去
  cleaned = cleaned.trim();
  
  return cleaned;
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
  
  // デバッグ情報: APIキーの長さと先頭文字をログに出力（マスク）
  const originalLength = apiKey.length;
  const prefix = apiKey.substring(0, Math.min(10, originalLength));
  const maskedPrefix = prefix.substring(0, 3) + '***' + prefix.substring(Math.max(3, prefix.length - 2));
  console.info(`🔑 APIキー検証: 長さ=${originalLength}, 先頭10文字=${maskedPrefix}...`);
  
  // まず改行と先頭・末尾の空白を除去
  const trimmed = apiKey.trim().replace(/\r\n|\r|\n/g, '');
  if (!trimmed) {
    console.error('❌ APIキーが空です（トリミング後）');
    throw new Error('API key is empty after trimming');
  }
  
  // サニタイズ前の長さを記録
  const beforeSanitizeLength = trimmed.length;
  
  // ヘッダー値としてサニタイズ
  const sanitized = sanitizeHeaderValue(trimmed);
  
  // サニタイズ後の長さを記録
  const afterSanitizeLength = sanitized.length;
  
  if (!sanitized || sanitized.length === 0) {
    console.error(`❌ APIキーサニタイズ後が空: 元の長さ=${originalLength}, トリミング後=${beforeSanitizeLength}, サニタイズ後=${afterSanitizeLength}`);
    throw new Error('API key contains no valid ASCII characters after sanitization');
  }
  
  // 最終確認: ASCII印字可能文字（0x20-0x7E）のみかチェック
  if (!/^[\x20-\x7E]+$/.test(sanitized)) {
    console.error(`❌ APIキーに無効な文字が含まれています: 長さ=${sanitized.length}, 先頭10文字=${sanitized.substring(0, 10)}`);
    // 無効な文字を検出
    const invalidChars = sanitized.split('').filter(c => !/[\x20-\x7E]/.test(c));
    console.error(`❌ 無効な文字: ${JSON.stringify(invalidChars)}`);
    throw new Error('API key contains invalid characters after sanitization');
  }
  
  // サニタイズ前後で長さが変わった場合、警告を出力
  if (beforeSanitizeLength !== afterSanitizeLength) {
    console.warn(`⚠️ APIキーの長さが変更されました: ${beforeSanitizeLength} → ${afterSanitizeLength} (${beforeSanitizeLength - afterSanitizeLength}文字削除)`);
  }
  
  console.info(`✅ APIキーサニタイズ成功: 長さ=${sanitized.length}`);
  
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

