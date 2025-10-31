// LIFFアプリの設定ファイル
// 環境変数から読み込み（Viteでは VITE_ プレフィックスが必要）

// URLパラメータから開発モードを確認（通常のブラウザでも動作させるため）
// windowオブジェクトはブラウザ環境でのみ利用可能
let isDevMode = false
if (typeof window !== 'undefined') {
  const urlParams = new URLSearchParams(window.location.search)
  isDevMode = urlParams.get('dev') === 'true' || import.meta.env.DEV
}

export const LIFF_CONFIG = {
  // LINE Developersで取得したLIFF ID
  liffId: import.meta.env.VITE_LIFF_ID || '',
  
  // 開発環境かどうか
  isDevelopment: import.meta.env.DEV,
  
  // 開発モード（通常のブラウザでも動作）
  isDevMode: isDevMode,
}

// Firebase設定（動画アップロード用）
export const FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
}

// ImageKit設定（画像アップロード用）
export const IMAGEKIT_CONFIG = {
  publicKey: import.meta.env.VITE_IMAGEKIT_PUBLIC_KEY || '',
  urlEndpoint: import.meta.env.VITE_IMAGEKIT_URL_ENDPOINT || '',
}

// Google Cloud Storage設定
export const GCS_CONFIG = {
  projectId: import.meta.env.VITE_GOOGLE_PROJECT_ID || '',
  bucketName: import.meta.env.VITE_GCS_BUCKET_NAME || '',
}

// Google Sheets設定（データ保存用）
export const SHEETS_CONFIG = {
  sheetId: import.meta.env.VITE_GOOGLE_SHEET_ID || '',
}

// 設定値の検証（開発環境のみ）
if (import.meta.env.DEV) {
  console.log('環境変数読み込み状況:', {
    liffId: LIFF_CONFIG.liffId ? '✓' : '✗',
    firebase: FIREBASE_CONFIG.apiKey ? '✓' : '✗',
    imagekit: IMAGEKIT_CONFIG.publicKey ? '✓' : '✗',
    googleSheet: SHEETS_CONFIG.sheetId ? '✓' : '✗',
    gcs: GCS_CONFIG.bucketName ? '✓' : '✗',
  })
}

