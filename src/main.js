// AIKA Battle Scouter - メインエントリーポイント
import './style.css'
import liff from '@line/liff'
import { LIFF_CONFIG } from './config.js'
import { uploadVideoToStorage } from './firebase.js'

// LIFF初期化（エラーハンドリング強化版）
async function initializeLIFF() {
  try {
    // LIFF IDが設定されているか確認
    if (!LIFF_CONFIG.liffId) {
      console.warn('LIFF IDが設定されていません。')
      // フォールバック表示（白い画面を防ぐ）
      showFallbackMessage('LIFF IDが設定されていません。Netlifyの環境変数設定を確認してください。')
      return
    }

    // LIFF初期化（タイムアウト付き）
    const initPromise = liff.init({ liffId: LIFF_CONFIG.liffId })
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('LIFF初期化がタイムアウトしました')), 10000)
    )
    
    await Promise.race([initPromise, timeoutPromise])
    
    // LIFFがロードされたか確認
    if (!liff.isLoggedIn()) {
      // ログインしていない場合はログインページへ（LINEアプリ内でのみ）
      if (liff.isInClient()) {
        liff.login()
        return
      } else {
        // ブラウザ環境ではフォールバック表示
        showFallbackMessage('このアプリはLINEアプリ内でのみ動作します。')
        return
      }
    }

    // ユーザー情報を取得
    const profile = await liff.getProfile()
    console.log('LIFF initialized successfully', profile)
    
    // アプリケーションを起動
    initApp(profile)
    
  } catch (error) {
    console.error('LIFF initialization failed:', error)
    
    // エラーでも白い画面にならないようにフォールバック表示
    showErrorMessage(error)
  }
}

// フォールバックメッセージ表示（白い画面を防ぐ）
function showFallbackMessage(message) {
  const container = document.querySelector('.container')
  if (!container) return
  
  const fallbackDiv = document.createElement('div')
  fallbackDiv.className = 'fallback-message'
  fallbackDiv.style.cssText = 'padding: 20px; background: rgba(255,255,255,0.1); border-radius: 10px; margin: 20px;'
  fallbackDiv.innerHTML = `
    <h3>ℹ️ 情報</h3>
    <p style="margin-top: 10px;">${message}</p>
    <p style="margin-top: 10px; font-size: 0.9rem; opacity: 0.8;">
      アプリは正常に読み込まれましたが、LIFFの初期化には追加設定が必要です。
    </p>
  `
  container.appendChild(fallbackDiv)
}

// エラーメッセージ表示（改善版）
function showErrorMessage(error) {
  const container = document.querySelector('.container')
  if (!container) {
    // コンテナが見つからない場合はbodyに直接追加
    document.body.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; padding: 20px;">
        <div style="text-align: center; max-width: 600px;">
          <h1>NEW WORLD</h1>
          <div style="padding: 20px; background: rgba(255,0,0,0.1); border-radius: 10px; margin-top: 20px;">
            <h3>⚠️ エラーが発生しました</h3>
            <p>${error.message}</p>
          </div>
        </div>
      </div>
    `
    return
  }
  
  const errorDiv = document.createElement('div')
  errorDiv.className = 'error-message'
  errorDiv.style.cssText = 'padding: 20px; background: rgba(255,0,0,0.1); border-radius: 10px; margin: 20px;'
  errorDiv.innerHTML = `
    <h3>⚠️ エラー: LIFF初期化に失敗しました</h3>
    <p><strong>エラー内容:</strong> ${error.message}</p>
    <details style="margin-top: 10px;">
      <summary style="cursor: pointer; color: #fff; font-size: 0.9rem;">トラブルシューティング</summary>
      <ul style="margin-top: 10px; padding-left: 20px; font-size: 0.9rem;">
        <li>LINE Developersで以下を確認してください：<br>
          - LIFFアプリが作成されているか<br>
          - LIFF IDが正しく設定されているか（現在: ${LIFF_CONFIG.liffId || '未設定'})<br>
          - アプリが公開状態になっているか</li>
        <li>このアプリはLINEアプリ内でのみ完全に動作します</li>
        <li>Netlifyの環境変数にVITE_LIFF_IDが設定されているか確認してください</li>
      </ul>
    </details>
  `
  container.appendChild(errorDiv)
}

// アプリケーション初期化
function initApp(profile) {
  console.log('App initialized for user:', profile.displayName)
  
  // ユーザー名を表示
  const userInfo = document.createElement('div')
  userInfo.className = 'user-info'
  userInfo.innerHTML = `
    <p style="margin-top: 1rem; font-size: 0.9rem; opacity: 0.9;">
      👋 ようこそ、<strong>${profile.displayName}</strong>さん
    </p>
    <p style="margin-top: 0.5rem; font-size: 0.8rem; opacity: 0.7;">
      LIFFアプリが正常に起動しました
    </p>
  `
  document.querySelector('.status')?.appendChild(userInfo)
  
  // 設定値の確認メッセージ（開発環境のみ）
  if (LIFF_CONFIG.isDevelopment) {
    const configStatus = document.createElement('div')
    configStatus.style.cssText = 'margin-top: 20px; padding: 15px; background: rgba(0,255,0,0.1); border-radius: 8px; font-size: 0.85rem;'
    configStatus.innerHTML = `
      <strong>✓ 環境変数読み込み状況:</strong>
      <ul style="margin-top: 10px; padding-left: 20px; list-style: none;">
        <li>LIFF ID: ${LIFF_CONFIG.liffId ? '✓ 設定済み' : '✗ 未設定'}</li>
        <li>Firebase: ${window.firebase ? '✓ 初期化済み' : '未初期化'}</li>
      </ul>
      <p style="margin-top: 10px; font-size: 0.75rem; opacity: 0.8;">
        動画アップロード機能の実装をお待ちください
      </p>
    `
    document.querySelector('.status')?.appendChild(configStatus)
  }
  
  // 動画アップロードUIを追加
  createVideoUploadUI(profile.userId)

  // ランドマークデータを分析して表示
  analyzeAndDisplayLandmarks()
}

// 動画アップロードUI作成
function createVideoUploadUI(userId) {
  const statusDiv = document.querySelector('.status')
  if (!statusDiv) return
  
  // アップロードセクションを作成
  const uploadSection = document.createElement('div')
  uploadSection.className = 'upload-section'
  uploadSection.style.cssText = 'margin-top: 2rem; padding: 1.5rem; background: rgba(255,255,255,0.15); border-radius: 10px;'
  uploadSection.innerHTML = `
    <h3 style="margin-bottom: 1rem; font-size: 1.3rem;">🎥 動画をアップロード</h3>
    <p style="margin-bottom: 1rem; font-size: 0.9rem; opacity: 0.9;">
      あなたのキックボクシング動画をアップロードして、AIKAがフォームを分析します。
    </p>
    <input 
      type="file" 
      id="videoInput" 
      accept="video/*" 
      style="display: none;"
    />
    <button 
      id="selectVideoBtn" 
      class="upload-button"
      style="width: 100%; padding: 12px 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none; border-radius: 8px; color: white; font-size: 1rem; cursor: pointer; font-weight: bold; box-shadow: 0 4px 15px rgba(0,0,0,0.2);"
    >
      📁 動画を選択
    </button>
    <div id="videoPreview" style="display: none; margin-top: 1rem;"></div>
    <div id="uploadProgress" style="display: none; margin-top: 1rem;"></div>
    <button 
      id="uploadBtn" 
      style="display: none; width: 100%; margin-top: 1rem; padding: 12px 24px; background: rgba(255,255,255,0.2); border: 2px solid rgba(255,255,255,0.5); border-radius: 8px; color: white; font-size: 1rem; cursor: pointer; font-weight: bold;"
    >
      ⬆️ アップロード開始
    </button>
  `
  statusDiv.appendChild(uploadSection)
  
  // イベントリスナー設定
  const videoInput = document.getElementById('videoInput')
  const selectBtn = document.getElementById('selectVideoBtn')
  const uploadBtn = document.getElementById('uploadBtn')
  const previewDiv = document.getElementById('videoPreview')
  const progressDiv = document.getElementById('uploadProgress')
  
  let selectedFile = null
  
  // ファイル選択ボタン
  selectBtn.addEventListener('click', () => {
    videoInput.click()
  })
  
  // ファイル選択時
  videoInput.addEventListener('change', (e) => {
    const file = e.target.files[0]
    if (!file) return
    
    // ファイルサイズチェック（100MB制限）
    const maxSize = 100 * 1024 * 1024 // 100MB
    if (file.size > maxSize) {
      alert('ファイルサイズが大きすぎます。100MB以下の動画を選択してください。')
      return
    }
    
    selectedFile = file
    
    // プレビュー表示
    const video = document.createElement('video')
    video.src = URL.createObjectURL(file)
    video.controls = true
    video.style.cssText = 'width: 100%; max-height: 300px; border-radius: 8px; margin-top: 1rem;'
    
    previewDiv.innerHTML = ''
    previewDiv.appendChild(video)
    previewDiv.style.display = 'block'
    uploadBtn.style.display = 'block'
    
    // ファイル情報表示
    const fileInfo = document.createElement('p')
    fileInfo.style.cssText = 'margin-top: 0.5rem; font-size: 0.85rem; opacity: 0.8;'
    fileInfo.textContent = `ファイル名: ${file.name} | サイズ: ${(file.size / 1024 / 1024).toFixed(2)}MB`
    previewDiv.appendChild(fileInfo)
  })
  
  // アップロードボタン
  uploadBtn.addEventListener('click', async () => {
    if (!selectedFile) return
    
    // UI更新
    uploadBtn.disabled = true
    uploadBtn.textContent = '⏳ アップロード中...'
    progressDiv.style.display = 'block'
    progressDiv.innerHTML = '<p>アップロードを開始しています...</p>'
    
    try {
      // 進捗監視
      window.addEventListener('uploadProgress', (e) => {
        const progress = e.detail.progress
        progressDiv.innerHTML = `
          <div style="background: rgba(255,255,255,0.2); border-radius: 8px; padding: 10px;">
            <p style="margin-bottom: 5px;">アップロード中: ${Math.round(progress)}%</p>
            <div style="background: rgba(255,255,255,0.3); border-radius: 4px; height: 8px; overflow: hidden;">
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); height: 100%; width: ${progress}%; transition: width 0.3s;"></div>
            </div>
          </div>
        `
      })
      
      // Firebase Storageにアップロード
      const downloadURL = await uploadVideoToStorage(selectedFile, userId)
      
      // 成功メッセージ
      progressDiv.innerHTML = `
        <div style="background: rgba(0,255,0,0.2); border-radius: 8px; padding: 15px; margin-top: 1rem;">
          <h4 style="margin-bottom: 0.5rem;">✅ アップロード成功！</h4>
          <p style="font-size: 0.9rem;">
            AIKAがあなたの動画を分析中です。結果は数分後にLINEで届きます。
          </p>
          <p style="margin-top: 0.5rem; font-size: 0.8rem; opacity: 0.8;">
            「ふふ、受け取ったわ。戦闘力を解析してあげる。結果は半日後に教えてあげるから、楽しみにしてなさい。」
          </p>
        </div>
      `
      
      uploadBtn.style.display = 'none'
      
      // リセット準備
      setTimeout(() => {
        videoInput.value = ''
        selectedFile = null
        previewDiv.style.display = 'none'
        progressDiv.innerHTML = ''
        uploadBtn.textContent = '⬆️ アップロード開始'
        uploadBtn.disabled = false
        uploadBtn.style.display = 'none'
      }, 5000)
      
    } catch (error) {
      console.error('アップロードエラー:', error)
      progressDiv.innerHTML = `
        <div style="background: rgba(255,0,0,0.2); border-radius: 8px; padding: 15px; margin-top: 1rem;">
          <h4 style="margin-bottom: 0.5rem;">❌ アップロード失敗</h4>
          <p style="font-size: 0.9rem;">${error.message}</p>
          <p style="margin-top: 0.5rem; font-size: 0.8rem; opacity: 0.8;">
            もう一度お試しください。
          </p>
        </div>
      `
      uploadBtn.disabled = false
      uploadBtn.textContent = '⬆️ アップロード開始'
    }
  })
}

// グローバルエラーハンドラー（白い画面を防ぐ）
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error)
  const container = document.querySelector('.container')
  if (container && !document.querySelector('.error-message')) {
    showErrorMessage(event.error || new Error('予期しないエラーが発生しました'))
  }
})

// Unhandled Promise Rejectionハンドラー
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason)
  const container = document.querySelector('.container')
  if (container && !document.querySelector('.error-message')) {
    showErrorMessage(event.reason || new Error('非同期処理でエラーが発生しました'))
  }
})

// ランドマークデータを分析して表示
async function analyzeAndDisplayLandmarks() {
  try {
    const response = await fetch('/landmarks.json');
    const data = await response.json();

    if (data && data.length > 0) {
      let totalY = 0;
      let landmarkCount = 0;

      data.forEach(frame => {
        if (frame.landmarks && frame.landmarks.length > 0) {
          // 鼻のランドマーク（インデックス0）のy座標を取得
          totalY += frame.landmarks[0].y;
          landmarkCount++;
        }
      });

      const averageY = totalY / landmarkCount;

      const analysisResultDiv = document.getElementById('analysis-result');
      analysisResultDiv.innerHTML = `
        <div style="padding: 20px; background: rgba(255,255,255,0.1); border-radius: 10px; margin: 20px;">
          <h3>骨格データ分析結果</h3>
          <p style="margin-top: 10px;">鼻のランドマークの平均Y座標: ${averageY.toFixed(4)}</p>
        </div>
      `;
    }
  } catch (error) {
    console.error('骨格データの分析中にエラーが発生しました:', error);
  }
}

// DOMContentLoaded時にLIFFを初期化
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded')
  
  // 少し遅延させてから初期化（DOMが確実に準備されていることを確認）
  setTimeout(() => {
    initializeLIFF().catch((error) => {
      console.error('Failed to initialize LIFF:', error)
      showErrorMessage(error)
    })
  }, 100)
})

