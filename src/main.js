// AIKA-18 UI Revolution - Main Entry Point
// Perfected by your partner.

import liff from '@line/liff';
import { LIFF_CONFIG } from './config.js';
import { uploadVideoToStorage, initFirebase } from './firebase.js';

// --- State Management & Constants ---

const appState = {
  uiState: 'initializing', // initializing, idle, uploading, success, error
  profile: null,
  selectedFile: null,
  errorMessage: '',
};

const TSUN_MESSAGES = {
  // Button Labels
  idleButton: '...別に、アンタの動画を解析してやってもいいけど？',
  uploadButton: '...これでいいんでしょ。さっさと解析しなさいよ。',

  // Feedback Messages
  processing: 'ちょっと！今、必死に見てやってんだから静かに待ちなさい！',
  uploading: (progress) => `…アップロード中よ (${progress}%)。焦らないで。`,
  success: '…まあ、動画は受け取ったわよ。結果はLINEで教えてあげる。せいぜい期待してなさいな。',
  
  // Errors
  fileTooBig: '…チッ、100MB以下の動画にしなさいよ。大きすぎて解析できないわ。',
  fileTooLong: (duration) => `…長すぎるわよ！今の動画は${duration}秒じゃない。10秒以内に収めなさい。`,
  invalidFile: '…この動画、読めないわ。別のファイルを選びなさい。',
  defaultError: '…フン、何か問題が起きたみたいね。もう一度やりなさい。',
  liffError: 'このアプリはLINEの中でしか使えないの。分かった？',
  timeoutError: '…タイムアウトしたわ。ネットワークを確認して、もう一度やりなさい。',
};

// --- UI Rendering ---

function renderUI() {
  const app = document.getElementById('app');
  if (!app) return;

  let html = '';

  switch (appState.uiState) {
    case 'uploading':
    case 'success':
    case 'processing':
      html = createFeedbackView();
      break;
    case 'error':
      html = createErrorView();
      break;
    case 'idle':
    default:
      html = createUploadView();
      break;
    case 'initializing':
      html = createFeedbackView({
        icon: '💭',
        message: '…ちょっと待ちなさい。準備中なんだから。',
        subMessage: 'Initializing...',
        type: 'processing'
      });
      break;
  }
  app.innerHTML = html;
  addEventListeners();
}

function createUploadView() {
  return `
    <div class="upload-container">
      <input type="file" id="video-input" accept="video/*" />
      <button id="upload-btn" class="giant-upload-btn">
        <div class="btn-icon">📹</div>
        <div class="btn-text">${TSUN_MESSAGES.idleButton}</div>
      </button>
    </div>
  `;
}

function createFeedbackView(override = {}) {
  const defaults = {
    processing: { icon: '💭', message: TSUN_MESSAGES.processing, subMessage: '解析中よ…', type: 'processing' },
    success: { icon: '✨', message: TSUN_MESSAGES.success, subMessage: '…別に、アンタのために頑張ったわけじゃないんだからね。', type: 'success' },
  };
  
  const stateDefaults = defaults[appState.uiState] || {};
  const { icon, message, subMessage, type, progress } = { ...stateDefaults, ...override };

  const progressHtml = typeof progress === 'number' ? `
    <div class="progress-bar-container">
      <div class="progress-bar" style="width: ${progress}%;"></div>
    </div>
  ` : '';

  return `
    <div class="feedback-container ${type}">
      <div class="icon">${icon}</div>
      <div class="message">${message}</div>
      ${subMessage ? `<div class="sub-message">${subMessage}</div>` : ''}
      ${progressHtml}
    </div>
  `;
}

function createErrorView() {
  return createFeedbackView({
    icon: '💢',
    message: '…チッ、エラーよ。',
    subMessage: appState.errorMessage || TSUN_MESSAGES.defaultError,
    type: 'error'
  });
}

// --- Event Handling ---

function addEventListeners() {
  const uploadBtn = document.getElementById('upload-btn');
  if (uploadBtn) {
    uploadBtn.addEventListener('click', () => document.getElementById('video-input').click());
  }

  const videoInput = document.getElementById('video-input');
  if (videoInput) {
    videoInput.addEventListener('change', handleFileSelect);
  }
}

// --- Core Logic ---

async function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  // ファイル選択ボタンを無効化（重複処理防止）
  const uploadBtn = document.getElementById('upload-btn');
  if (uploadBtn) {
    uploadBtn.disabled = true;
    uploadBtn.classList.add('loading-state');
  }

  // 読み込み中メッセージを表示
  setState({ 
    uiState: 'processing',
    errorMessage: ''
  });

  try {
    // 1. Validate File Size
    if (file.size > 100 * 1024 * 1024) {
      if (uploadBtn) {
        uploadBtn.disabled = false;
        uploadBtn.classList.remove('loading-state');
      }
      return handleError(TSUN_MESSAGES.fileTooBig);
    }

    // 2. Validate Video Duration（モバイル最適化版）
    let duration;
    try {
      duration = await getVideoDuration(file);
      
      if (duration > 10) {
        if (uploadBtn) {
          uploadBtn.disabled = false;
          uploadBtn.classList.remove('loading-state');
        }
        return handleError(TSUN_MESSAGES.fileTooLong(duration.toFixed(1)));
      }
    } catch (error) {
      console.error('Video duration check error:', error);
      
      if (uploadBtn) {
        uploadBtn.disabled = false;
        uploadBtn.classList.remove('loading-state');
      }
      
      // より具体的なエラーメッセージ
      if (error.message.includes('タイムアウト')) {
        return handleError('…動画の読み込みがタイムアウトしたわ。ネットワークを確認して、もう一度やりなさい。');
      } else if (error.message.includes('読み込めません')) {
        return handleError(TSUN_MESSAGES.invalidFile);
      } else {
        return handleError('…この動画、処理できないわ。別の動画を選びなさい。');
      }
    }
    
    // 検証成功
    appState.selectedFile = file;
    
    if (uploadBtn) {
      uploadBtn.disabled = false;
      uploadBtn.classList.remove('loading-state');
    }
    
    // アップロード開始
    handleUpload();
    
  } catch (error) {
    console.error('File selection error:', error);
    
    if (uploadBtn) {
      uploadBtn.disabled = false;
      uploadBtn.classList.remove('loading-state');
    }
    
    handleError(error.message || TSUN_MESSAGES.defaultError);
  }
}

async function handleUpload() {
  if (!appState.selectedFile || !appState.profile) return;

  setState({ uiState: 'uploading' });

  try {
    const onProgress = (progress) => {
      const message = TSUN_MESSAGES.uploading(Math.round(progress));
      const app = document.getElementById('app');
      if (app) {
        app.innerHTML = createFeedbackView({ icon: '💭', message, type: 'processing', progress });
      }
    };

    await uploadVideoToStorage(appState.selectedFile, appState.profile.userId, onProgress);
    
    setState({ uiState: 'success' });

    // Reset after a few seconds
    setTimeout(() => setState({ uiState: 'idle', selectedFile: null }), 5000);

  } catch (error) {
    console.error('Upload failed:', error);
    handleError(error.message);
  }
}

function handleError(message) {
  setState({ uiState: 'error', errorMessage: message });
  // Reset after a few seconds
  setTimeout(() => setState({ uiState: 'idle', errorMessage: '' }), 5000);
}

// --- Initialization ---

async function main() {
  renderUI(); // Show "initializing" message
  try {
    await initFirebase();
    const profile = await initLiff();
    appState.profile = profile;
    setState({ uiState: 'idle' });
  } catch (error) {
    console.error('Initialization failed:', error);
    handleError(TSUN_MESSAGES.liffError);
  }
}

async function initLiff() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('dev') === 'true' || import.meta.env.DEV) {
      console.log('🔧 Development mode detected.');
      return {
        userId: 'dev_user_' + Date.now(),
        displayName: 'Developer',
      };
    }

    // LIFF初期化（タイムアウト付き）
    await Promise.race([
      liff.init({ liffId: LIFF_CONFIG.liffId }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('LIFF初期化タイムアウト')), 15000)
      )
    ]);

    if (!liff.isLoggedIn()) {
      liff.login();
      // This will redirect, so we wait indefinitely
      return new Promise(() => {}); 
    }

    // プロファイル取得（リトライ付き、タイムアウト付き）
    let profile;
    let lastError;
    
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        profile = await Promise.race([
          liff.getProfile(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('プロファイル取得タイムアウト')), 10000)
          )
        ]);
        
        if (profile && profile.userId) {
          console.log('✅ LIFF profile retrieved:', profile.userId);
          return profile;
        }
      } catch (error) {
        console.warn(`⚠️ LIFF profile attempt ${attempt + 1} failed:`, error);
        lastError = error;
        
        // リトライ前に少し待機（指数バックオフ）
        if (attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    }
    
    // 全リトライ失敗
    throw lastError || new Error('プロファイル取得に失敗しました');
    
  } catch (error) {
    console.error('LIFF initialization failed:', error);
    
    // より具体的なエラーメッセージ
    if (error.message.includes('タイムアウト')) {
      throw new Error('認証処理がタイムアウトしました。ネットワーク環境を確認して、もう一度お試しください。');
    } else if (error.message.includes('プロファイル取得')) {
      throw new Error('ユーザー情報の取得に失敗しました。LINEアプリ内でページを再読み込みしてください。');
    } else {
      throw new Error('LIFF初期化に失敗しました。LINEアプリ内で開いていることを確認してください。');
    }
  }
}

// --- Utility Functions ---

function setState(newState) {
  Object.assign(appState, newState);
  renderUI();
}

function getVideoDuration(file) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true; // モバイルで音声再生がブロックされないように
    video.playsInline = true; // iOSでインライン再生を許可
    
    let timeoutId;
    let objectURL;
    
    // 30秒タイムアウト（モバイルでのメタデータ読み込み遅延に対応）
    timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error('動画の読み込みがタイムアウトしました。ネットワーク環境を確認してください。'));
    }, 30000);
    
    const cleanup = () => {
      clearTimeout(timeoutId);
      if (objectURL) {
        window.URL.revokeObjectURL(objectURL);
      }
      video.src = '';
      video.load(); // リソースを解放
    };
    
    video.onloadedmetadata = () => {
      const duration = video.duration;
      cleanup();
      
      if (isNaN(duration) || duration <= 0) {
        reject(new Error('動画の長さを取得できませんでした。'));
        return;
      }
      
      resolve(duration);
    };
    
    video.onerror = (e) => {
      cleanup();
      reject(new Error('動画ファイルを読み込めませんでした。ファイル形式を確認してください。'));
    };
    
    // メタデータ読み込みを開始
    try {
      objectURL = window.URL.createObjectURL(file);
      video.src = objectURL;
      video.load(); // 明示的に読み込み開始
    } catch (error) {
      cleanup();
      reject(new Error('動画ファイルの処理中にエラーが発生しました。'));
    }
  });
}

// --- Start the App ---
main();

