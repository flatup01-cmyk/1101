import { admin } from './initAdmin.js';

const firestore = admin.firestore();
const storageBucket = admin.storage().bucket();
const FieldValue = admin.firestore.FieldValue;

const STORAGE_LIMIT_BYTES = Math.floor(4.9 * 1024 * 1024 * 1024); // 約4.9GB
const STORAGE_CACHE_MS = 60 * 1000;
let cachedStorageUsage = {
  value: 0,
  fetchedAt: 0,
};

const DAILY_QUOTA_LIMITS = {
  video: 1,
  image: 3,
  text: 5,
};

export const QUOTA_MESSAGES = {
  storage: {
    jp: '現在ストレージが満杯です。数日後に再度お試しください。',
    en: 'Storage is full. Please try again in a few days.',
  },
  quota: {
    jp: '本日の無料枠は終了しました。明日また試してください。',
    en: 'Your free quota for today has been reached. Please try again tomorrow.',
  },
  disabled: {
    jp: '現在混雑のため受付停止中です。しばらく時間をおいて試してください。',
    en: 'Service is temporarily unavailable due to high demand. Please try again later.',
  },
  overload: {
    jp: '現在AIが混み合っています。しばらくしてから再試行してください。',
    en: 'The AI is overloaded. Please retry after a short wait.',
  },
};

export function buildBilingualMessage(jp, en) {
  return `${jp}\n\n${en}`;
}

function getTodayKey() {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

export function isLikelyValidLineUserId(userId) {
  return typeof userId === 'string' && /^U[a-fA-F0-9]{32}$/.test(userId);
}

async function isProcessingDisabled() {
  try {
    const doc = await firestore.doc('system_settings/processingGuard').get();
    return doc.exists && doc.data()?.isDisabled === true;
  } catch (error) {
    console.error('停止フラグ確認エラー:', error);
    return false;
  }
}

async function getCurrentStorageUsageBytes() {
  const now = Date.now();
  if (now - cachedStorageUsage.fetchedAt < STORAGE_CACHE_MS) {
    return cachedStorageUsage.value;
  }

  let totalBytes = 0;
  let pageToken = undefined;

  try {
    do {
      const [files, nextQuery] = await storageBucket.getFiles({
        autoPaginate: false,
        pageToken,
      });
      for (const file of files) {
        const size = Number(file.metadata?.size || 0);
        if (!Number.isNaN(size)) {
          totalBytes += size;
        }
      }
      pageToken = nextQuery?.pageToken;
    } while (pageToken);
  } catch (error) {
    console.error('ストレージ使用量の取得に失敗しました:', error);
    throw error;
  }

  cachedStorageUsage = {
    value: totalBytes,
    fetchedAt: now,
  };

  return totalBytes;
}

async function checkStorageCapacity() {
  try {
    const usage = await getCurrentStorageUsageBytes();
    if (usage >= STORAGE_LIMIT_BYTES) {
      return {
        allowed: false,
        reason: 'storage',
        messageJP: QUOTA_MESSAGES.storage.jp,
        messageEN: QUOTA_MESSAGES.storage.en,
        statusCode: 503,
      };
    }
    return { allowed: true };
  } catch (error) {
    console.error('ストレージ容量チェックエラー:', error);
    return { allowed: true };
  }
}

async function reserveDailyQuota(userId, contentType) {
  const limit = DAILY_QUOTA_LIMITS[contentType];
  if (!limit || !isLikelyValidLineUserId(userId)) {
    return { allowed: true };
  }

  const usageRef = firestore.collection('daily_usage').doc(userId);
  const today = getTodayKey();

  try {
    const result = await firestore.runTransaction(async (tx) => {
      const snapshot = await tx.get(usageRef);
      let data = snapshot.exists ? snapshot.data() : {};
      let counts = data.counts || {};
      let currentDate = data.date;

      if (currentDate !== today) {
        counts = {};
        currentDate = today;
      }

      const currentCount = counts[contentType] || 0;
      if (currentCount >= limit) {
        return { allowed: false };
      }

      const newCounts = {
        ...counts,
        [contentType]: currentCount + 1,
      };

      tx.set(
        usageRef,
        {
          date: currentDate,
          counts: newCounts,
          updated_at: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      return { allowed: true };
    });

    if (!result.allowed) {
      return {
        allowed: false,
        reason: 'quota',
        messageJP: QUOTA_MESSAGES.quota.jp,
        messageEN: QUOTA_MESSAGES.quota.en,
        statusCode: 429,
      };
    }

    return { allowed: true };
  } catch (error) {
    console.error('日次クォータ処理エラー:', error);
    return {
      allowed: false,
      reason: 'quota_error',
      messageJP: QUOTA_MESSAGES.disabled.jp,
      messageEN: QUOTA_MESSAGES.disabled.en,
      statusCode: 503,
    };
  }
}

export async function checkProcessingGuards({ userId, contentType }) {
  if (await isProcessingDisabled()) {
    return {
      allowed: false,
      reason: 'disabled',
      messageJP: QUOTA_MESSAGES.disabled.jp,
      messageEN: QUOTA_MESSAGES.disabled.en,
      statusCode: 503,
    };
  }

  const storageResult = await checkStorageCapacity();
  if (!storageResult.allowed) {
    return storageResult;
  }

  const quotaResult = await reserveDailyQuota(userId, contentType);
  if (!quotaResult.allowed) {
    return quotaResult;
  }

  return { allowed: true };
}

export async function notifyGuardDenied({ lineClient, replyToken, userId, guardResult }) {
  const messageJP = guardResult.messageJP ?? QUOTA_MESSAGES.disabled.jp;
  const messageEN = guardResult.messageEN ?? QUOTA_MESSAGES.disabled.en;
  const messageText = buildBilingualMessage(messageJP, messageEN);

  try {
    if (replyToken) {
      await lineClient.replyMessage(replyToken, { type: 'text', text: messageText });
    } else if (isLikelyValidLineUserId(userId)) {
      await lineClient.pushMessage(userId, { type: 'text', text: messageText });
    }
  } catch (error) {
    console.error('停止ガード通知の送信に失敗しました:', error);
  }
}

