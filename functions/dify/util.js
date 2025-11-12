// Utility helpers for Dify integrations

/**
 * Ensure required environment variable exists and return its trimmed value.
 * @param {string} name
 * @returns {string}
 */
export function requireEnv(name) {
  const raw = process.env[name];
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    throw new Error(`Environment variable ${name} is required`);
  }
  return raw.trim();
}

/**
 * Build fallback message when Dify could not provide a complete answer.
 * @param {string} [detail]
 * @returns {string}
 */
export function buildFallbackAnswer(detail = '現在詳細取得に時間がかかっています') {
  const suffix = detail.replace(/\s+/g, ' ').trim();
  return `動画の解析サマリー: ${suffix}。後ほど完全版を送信します。`;
}

/**
 * Normalise usage payload from Dify so numeric values become numbers.
 * @param {Record<string, any>} usage
 * @returns {Record<string, any>}
 */
export function normalizeUsage(usage) {
  if (!usage || typeof usage !== 'object') return usage ?? {};

  const normalised = {};
  for (const [key, value] of Object.entries(usage)) {
    if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
      normalised[key] = Number(value);
      continue;
    }
    if (value && typeof value === 'object') {
      normalised[key] = normalizeUsage(value);
      continue;
    }
    normalised[key] = value;
  }
  return normalised;
}


