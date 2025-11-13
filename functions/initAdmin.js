import admin from 'firebase-admin';

function getStorageBucket() {
  const defaultBucket = 'aikaapp-584fa.firebasestorage.app';

  try {
    if (process.env.FIREBASE_CONFIG) {
      const config = JSON.parse(process.env.FIREBASE_CONFIG);
      if (config?.storageBucket) {
        return config.storageBucket;
      }
    }
  } catch (error) {
    console.warn('Failed to parse FIREBASE_CONFIG;', error);
  }

  if (process.env.FIREBASE_STORAGE_BUCKET?.trim()) {
    return process.env.FIREBASE_STORAGE_BUCKET.trim();
  }

  return defaultBucket;
}

if (!admin.apps.length) {
  admin.initializeApp({
    storageBucket: getStorageBucket(),
  });
}

export { admin };

