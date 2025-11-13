export function requireEnv(key, { allowEmpty = false, defaultValue = undefined } = {}) {
  const value = process.env[key];
  if (value === undefined || value === null || (!allowEmpty && value === '')) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
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

