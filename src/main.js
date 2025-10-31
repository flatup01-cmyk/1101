// AIKA Battle Scouter - メインエントリーポイント
import './style.css'
import liff from '@line/liff'
import { LIFF_CONFIG } from './config.js'
import { uploadVideoToStorage } from './firebase.js'
import { displayAikaReaction, applyAikaImageAnimation, createScoreDisplayArea, getAikaReaction } from './aika-animations.js'
import { testAikaReactions } from './test-score-display.js'

// XSS対策: HTMLエスケープ関数（グローバル）
function escapeHtml(text) {
  if (!text) return ''
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

// 開発モード用のモックユーザー情報（通常のブラウザでも動作させるため）
function createMockProfile() {
  return {
    userId: 'dev_user_' + Date.now(),
    displayName: 'テストユーザー（開発モード）',
    pictureUrl: '',
    statusMessage: '開発モードで実行中'
  }
}

// LIFF初期化（エラーハンドリング強化版）
async function initializeLIFF() {
  try {
    // URLパラメータを直接チェック（デプロイが完了していない場合のフォールバック）
    const urlParams = new URLSearchParams(window.location.search)
    const urlDevMode = urlParams.get('dev') === 'true'
    const configDevMode = LIFF_CONFIG.isDevMode || import.meta.env.DEV
    
    // 開発モードのチェック（通常のブラウザでも動作させる）
    if (urlDevMode || configDevMode) {
      console.log('🔧 開発モード検出:', {
        urlDevMode,
        configDevMode,
        currentUrl: window.location.href
      })
      
      // モックユーザー情報でアプリを起動
      const mockProfile = createMockProfile()
      console.log('✅ 開発モードで初期化:', mockProfile)
      initApp(mockProfile)
      return
    }

    // LIFF IDが設定されているか確認
    if (!LIFF_CONFIG.liffId) {
      console.warn('LIFF IDが設定されていません。')
      // フォールバック表示（白い画面を防ぐ）
      showFallbackMessage('LIFF IDが設定されていません。Netlifyの環境変数設定を確認してください。')
      return
    }

    // 環境診断情報
    console.log('🔍 LIFF環境診断:', {
      userAgent: navigator.userAgent,
      url: window.location.href,
      liffId: LIFF_CONFIG.liffId
    })

    // LIFF初期化（タイムアウト付き）
    const initPromise = liff.init({ liffId: LIFF_CONFIG.liffId })
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('LIFF初期化がタイムアウトしました')), 10000)
    )
    
    await Promise.race([initPromise, timeoutPromise])
    
    // 初期化後の状態を確認
    console.log('✅ LIFF初期化成功:', {
      isLoggedIn: liff.isLoggedIn(),
      isInClient: liff.isInClient(),
      os: liff.getOS(),
      language: liff.getLanguage(),
      version: liff.getVersion()
    })
    
    // LIFFがロードされたか確認
    if (!liff.isLoggedIn()) {
      // ログインしていない場合はログインページへ（LINEアプリ内でのみ）
      if (liff.isInClient()) {
        console.log('🔐 LINEアプリ内でログインを試みます...')
        liff.login()
        return
      } else {
        // ブラウザ環境では詳細な診断情報と共にフォールバック表示
        const currentUrl = window.location.href
        const devModeUrl = currentUrl.includes('?') 
          ? currentUrl + '&dev=true'
          : currentUrl + '?dev=true'
        
        const diagnosticInfo = `
          <div style="margin-top: 15px; padding: 15px; background: rgba(0,0,0,0.2); border-radius: 8px; font-size: 0.9rem;">
            <strong>📋 診断情報:</strong><br>
            • URL: ${escapeHtml(window.location.href)}<br>
            • User Agent: ${escapeHtml(navigator.userAgent.substring(0, 100))}...<br>
            • LIFF ID: ${escapeHtml(LIFF_CONFIG.liffId)}<br><br>
            <strong>💡 解決方法（2つの選択肢）:</strong><br><br>
            <strong>方法1: LINEアプリ内で開く（推奨）</strong><br>
            1. PC版LINEデスクトップアプリを起動してください<br>
            2. LINEアプリ内で自分にメッセージを送信してください<br>
            3. 以下のURLを貼り付けて、LINEアプリ内でクリックしてください:<br>
            <code style="background: rgba(255,255,255,0.1); padding: 5px; border-radius: 4px; display: inline-block; margin-top: 5px; margin-bottom: 15px;">
              https://liff.line.me/2008276179-XxwM2QQD
            </code><br><br>
            <strong>方法2: 開発モードで動作させる（通常のブラウザでも動作）</strong><br>
            以下のURLをクリックすると、通常のブラウザでも動作します（開発モード）:<br>
            <a href="${escapeHtml(devModeUrl)}" style="color: #64c8ff; text-decoration: underline; display: inline-block; margin-top: 5px;">
              ${escapeHtml(devModeUrl)}
            </a><br>
            <small style="opacity: 0.7; margin-top: 5px; display: block;">
              ⚠️ 開発モードでは一部機能が制限されます（動画アップロードは動作します）
            </small>
          </div>
        `
        showFallbackMessage('このアプリはLINEアプリ内でのみ動作します。' + diagnosticInfo)
        return
      }
    }

    // ユーザー情報を取得
    const profile = await liff.getProfile()
    console.log('✅ LIFF initialized successfully', profile)
    
    // アプリケーションを起動
    initApp(profile)
    
  } catch (error) {
    console.error('❌ LIFF initialization failed:', error)
    
    // 詳細な診断情報を含むエラーメッセージ
    const diagnosticError = `
      <div style="margin-top: 15px; padding: 15px; background: rgba(255,0,0,0.1); border-radius: 8px; font-size: 0.9rem;">
        <strong>📋 診断情報:</strong><br>
        • エラー: ${escapeHtml(error.message || '不明なエラー')}<br>
        • URL: ${escapeHtml(window.location.href)}<br>
        • User Agent: ${escapeHtml(navigator.userAgent.substring(0, 100))}...<br>
        • LIFF ID: ${escapeHtml(LIFF_CONFIG.liffId || '未設定')}<br><br>
        <strong>💡 確認事項:</strong><br>
        1. LINEデスクトップアプリ内で開いていますか？<br>
        2. LIFF URLをLINEアプリ内でクリックしましたか？<br>
        3. 通常のブラウザ（Chrome/Safari）で開いていませんか？<br>
      </div>
    `
    
    // エラーでも白い画面にならないようにフォールバック表示
    showErrorMessage(new Error(error.message + diagnosticError))
  }
}

// フォールバックメッセージ表示（白い画面を防ぐ）
function showFallbackMessage(message) {
  const container = document.querySelector('.container')
  if (!container) return
  
  const fallbackDiv = document.createElement('div')
  fallbackDiv.className = 'fallback-message'
  fallbackDiv.style.cssText = 'padding: 20px; background: rgba(255,255,255,0.1); border-radius: 10px; margin: 20px; color: #fff;'
  fallbackDiv.innerHTML = `
    <h3>ℹ️ 情報</h3>
    <div style="margin-top: 10px;">${message}</div>
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
            <p>${escapeHtml(error.message || '不明なエラーが発生しました')}</p>
          </div>
        </div>
      </div>
    `
    return
  }
  
  const errorDiv = document.createElement('div')
  errorDiv.className = 'error-message'
  errorDiv.style.cssText = 'padding: 20px; background: rgba(255,0,0,0.1); border-radius: 10px; margin: 20px;'
  
  // エラーメッセージから診断情報を抽出（HTMLが含まれている場合）
  const errorMessage = error.message || '不明なエラー'
  const hasDiagnostics = errorMessage.includes('<div')
  
  errorDiv.innerHTML = `
    <h3>⚠️ エラー: LIFF初期化に失敗しました</h3>
    ${hasDiagnostics ? errorMessage : `<p><strong>エラー内容:</strong> ${escapeHtml(errorMessage)}</p>`}
    <details style="margin-top: 10px;">
      <summary style="cursor: pointer; color: #fff; font-size: 0.9rem;">トラブルシューティング</summary>
      <ul style="margin-top: 10px; padding-left: 20px; font-size: 0.9rem;">
        <li>LINE Developersで以下を確認してください：<br>
          - LIFFアプリが作成されているか<br>
          - LIFF IDが正しく設定されているか（現在: ${escapeHtml(LIFF_CONFIG.liffId || '未設定')})<br>
          - アプリが公開状態になっているか</li>
        <li>このアプリはLINEアプリ内でのみ完全に動作します</li>
        <li>Netlifyの環境変数にVITE_LIFF_IDが設定されているか確認してください</li>
        <li><strong>PC版LINEで使用する場合:</strong><br>
          1. LINEデスクトップアプリを起動<br>
          2. 自分にメッセージを送る<br>
          3. LIFF URLを貼り付けて、LINEアプリ内でクリック<br>
          <code style="background: rgba(255,255,255,0.1); padding: 5px; border-radius: 4px; display: inline-block; margin-top: 5px;">
            https://liff.line.me/2008276179-XxwM2QQD
          </code>
        </li>
      </ul>
    </details>
  `
  container.appendChild(errorDiv)
}

// アプリケーション初期化
function initApp(profile) {
  console.log('App initialized for user:', profile.displayName)
  
  // AIKA18号の挨拶（ツンデレ口調）+ スカウター表示
  const userInfo = document.createElement('div')
  userInfo.className = 'user-info'
  userInfo.innerHTML = `
    <div class="scouter-display" style="margin-top: 1rem; padding: 15px; background: rgba(0, 0, 0, 0.3); border-radius: 8px; border: 2px solid rgba(100, 200, 255, 0.5); font-family: 'Courier New', monospace;">
      <div style="font-size: 0.75rem; color: #64c8ff; margin-bottom: 8px; text-align: left;">
        ▸ FORM ANALYZE READY
      </div>
      <div style="font-size: 0.9rem; color: #ffeb3b; margin-bottom: 8px; text-align: left;">
        ▸ POWER LEVEL: ??
      </div>
      <div style="font-size: 0.85rem; color: #fff; margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(100, 200, 255, 0.3);">
        ようこそ、<strong style="color: #64c8ff;">${escapeHtml(profile.displayName)}</strong>。<br>
        <span style="font-size: 0.85rem; color: #ff9800; margin-top: 5px; display: block;">
          …フン、そんな腕でどこまで通用するか、見定めてやる。
        </span>
      </div>
    </div>
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
    `
    document.querySelector('.status')?.appendChild(configStatus)
    
    // 開発環境でのみテスト機能を有効化
    setTimeout(() => testAikaReactions(), 1000)
  }
  
  // 動画アップロードUIを追加
  createVideoUploadUI(profile.userId)
  
  // スコア表示エリアを作成
  createScoreDisplayArea()

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
    <div style="margin-bottom: 1rem; padding: 12px; background: rgba(0, 0, 0, 0.3); border-radius: 8px; border: 1px solid rgba(100, 200, 255, 0.4); font-family: 'Courier New', monospace;">
      <div style="font-size: 0.75rem; color: #64c8ff; margin-bottom: 5px; text-align: left;">
        ▸ VIDEO UPLOAD MODULE
      </div>
      <h3 style="margin-bottom: 0.8rem; font-size: 1.2rem; color: #fff;">🎯 動画アップロード</h3>
    </div>
    <p style="margin-bottom: 1rem; font-size: 0.95rem; opacity: 0.95; line-height: 1.6; padding: 10px; background: rgba(255, 255, 255, 0.1); border-radius: 6px;">
      フン、動画をセットしろ。AIKA18号のバトルスコープが、アンタの戦闘力を採点してやるよ。…せいぜい頑張りな。<br>
      <span style="font-size: 0.85rem; opacity: 0.8; color: #64c8ff;">(最大100MB)</span>
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
      🎯 動画をセット
    </button>
    <div id="videoPreview" style="display: none; margin-top: 1rem;"></div>
    <div id="uploadProgress" style="display: none; margin-top: 1rem;"></div>
    <button 
      id="uploadBtn" 
      style="display: none; width: 100%; margin-top: 1rem; padding: 12px 24px; background: rgba(255,255,255,0.2); border: 2px solid rgba(255,255,255,0.5); border-radius: 8px; color: white; font-size: 1rem; cursor: pointer; font-weight: bold;"
    >
      🚀 解析開始
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
      alert('…チッ、100MB以下の動画を選択しろよ。大きすぎて解析できやしないわ。')
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
    uploadBtn.textContent = '⏳ 解析準備中...'
      progressDiv.style.display = 'block'
      progressDiv.innerHTML = `
        <div style="background: rgba(0, 0, 0, 0.4); border-radius: 8px; padding: 15px; border: 2px solid rgba(100, 200, 255, 0.5); font-family: 'Courier New', monospace;">
          <div style="font-size: 0.75rem; color: #ff9800; margin-bottom: 8px; text-align: left;">
            ▸ INITIALIZING ANALYSIS...
          </div>
          <div style="font-size: 0.85rem; color: #fff; margin-top: 5px;">
            …解析を開始するわよ。ちょっと待ちなさい。
          </div>
        </div>
      `
    
    try {
      // 進捗監視
      window.addEventListener('uploadProgress', (e) => {
        const progress = e.detail.progress
        progressDiv.innerHTML = `
          <div style="background: rgba(0, 0, 0, 0.4); border-radius: 8px; padding: 15px; border: 2px solid rgba(100, 200, 255, 0.5); font-family: 'Courier New', monospace;">
            <div style="font-size: 0.75rem; color: #64c8ff; margin-bottom: 8px; text-align: left;">
              ▸ UPLOAD PROGRESS: ${Math.round(progress)}%
            </div>
            <div style="background: rgba(0, 0, 0, 0.5); border-radius: 4px; height: 12px; overflow: hidden; border: 1px solid rgba(100, 200, 255, 0.3); margin-top: 8px;">
              <div style="background: linear-gradient(90deg, #64c8ff 0%, #64ff64 100%); height: 100%; width: ${progress}%; transition: width 0.3s; box-shadow: 0 0 10px rgba(100, 255, 255, 0.5);"></div>
            </div>
          </div>
        `
      })
      
      // Firebase Storageにアップロード
      const downloadURL = await uploadVideoToStorage(selectedFile, userId)
      
      // AIKA18号の成功メッセージ（ツンデレ口調）+ スカウター表示
      progressDiv.innerHTML = `
        <div style="background: rgba(0, 0, 0, 0.4); border-radius: 8px; padding: 15px; margin-top: 1rem; border: 2px solid rgba(0, 255, 100, 0.5); font-family: 'Courier New', monospace;">
          <div style="font-size: 0.75rem; color: #64ff64; margin-bottom: 8px; text-align: left;">
            ▸ DATA UPLOAD COMPLETE
          </div>
          <div style="font-size: 0.75rem; color: #64c8ff; margin-bottom: 8px; text-align: left;">
            ▸ ANALYSIS IN PROGRESS...
          </div>
          <div style="font-size: 0.85rem; color: #fff; margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(100, 255, 100, 0.3);">
            …まあ、動画は受け取ったわよ。AIKA18号のバトルスコープが解析中よ。<br>
            <span style="font-size: 0.8rem; color: #ff9800; margin-top: 5px; display: block;">
              結果は数分後にLINEで届くわ。フン、せいぜい期待してなさいな。
            </span>
          </div>
        </div>
      `
      
      // AIKA画像に解析中アニメーション（軽く）
      applyAikaImageAnimation('', 0) // 一時的にアニメーション解除
      
      uploadBtn.style.display = 'none'
      
      // リセット準備
      setTimeout(() => {
        videoInput.value = ''
        selectedFile = null
        previewDiv.style.display = 'none'
        progressDiv.innerHTML = ''
        uploadBtn.textContent = '🚀 解析開始'
        uploadBtn.disabled = false
        uploadBtn.style.display = 'none'
      }, 5000)
      
    } catch (error) {
      console.error('アップロードエラー:', error)
      progressDiv.innerHTML = `
        <div style="background: rgba(0, 0, 0, 0.4); border-radius: 8px; padding: 15px; margin-top: 1rem; border: 2px solid rgba(255, 100, 100, 0.5); font-family: 'Courier New', monospace;">
          <div style="font-size: 0.75rem; color: #ff6464; margin-bottom: 8px; text-align: left;">
            ▸ ERROR DETECTED
          </div>
          <div style="font-size: 0.85rem; color: #fff; margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255, 100, 100, 0.3);">
            …チッ、エラーよ。<br>
            <span style="font-size: 0.8rem; color: #ff9800; margin-top: 5px; display: block;">
              ${escapeHtml(error.message || '何か問題が発生したわ')}
            </span>
            <span style="font-size: 0.75rem; color: #64c8ff; margin-top: 8px; display: block;">
              もう一度やり直しなさい。
            </span>
          </div>
        </div>
      `
      uploadBtn.disabled = false
      uploadBtn.textContent = '🚀 解析開始'
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
  console.log('🔍 開発モードチェック:', {
    url: window.location.href,
    devParam: new URLSearchParams(window.location.search).get('dev'),
    isDevMode: LIFF_CONFIG.isDevMode,
    isDevelopment: import.meta.env.DEV
  })
  
  // 少し遅延させてから初期化（DOMが確実に準備されていることを確認）
  setTimeout(() => {
    initializeLIFF().catch((error) => {
      console.error('Failed to initialize LIFF:', error)
      showErrorMessage(error)
    })
  }, 100)
})

