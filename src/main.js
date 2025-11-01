// AIKA Battle Scouter - メインエントリーポイント
import './style.css'
import liff from '@line/liff'
import { LIFF_CONFIG } from './config.js'
import { uploadVideoToStorage } from './firebase.js'
import { displayAikaReaction, applyAikaImageAnimation, createScoreDisplayArea, getAikaReaction } from './aika-animations.js'

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

    // LIFF初期化（タイムアウト延長：20秒）
    const initPromise = liff.init({ liffId: LIFF_CONFIG.liffId })
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('LIFF初期化がタイムアウトしました（20秒）')), 20000)
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
  console.log('App initialized for user:', profile.displayName, 'userId:', profile.userId)
  
  // userIdが取得できているか確認
  if (!profile.userId) {
    console.warn('⚠️ userIdが取得できていません。profile:', profile)
    // LIFFプロファイルを再取得
    if (typeof liff !== 'undefined' && liff.isLoggedIn()) {
      liff.getProfile()
        .then((updatedProfile) => {
          if (updatedProfile.userId) {
            profile.userId = updatedProfile.userId
            console.log('✅ userIdを再取得:', profile.userId)
            // 動画アップロードUIを再作成
            createVideoUploadUI(profile.userId)
          }
        })
        .catch((error) => {
          console.error('❌ LIFFプロファイル再取得失敗:', error)
        })
    }
  }
  
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
  }
  
  // 動画アップロードUIを追加
  createVideoUploadUI(profile.userId)
  
  // スコア表示エリアを作成
  createScoreDisplayArea()

  // ランドマークデータを分析して表示
  analyzeAndDisplayLandmarks()
}

// 動画アップロードUI作成（革命的UI版）
function createVideoUploadUI(userId) {
  const actionContainer = document.getElementById('action-container')
  if (!actionContainer) return
  
  // 既存のコンテンツを削除
  actionContainer.innerHTML = ''
  
  // 最小限のUI：巨大なアップロードボタンだけ
  const uploadSection = document.createElement('div')
  uploadSection.className = 'upload-section'
  uploadSection.innerHTML = `
    <!-- 隠しファイル入力 -->
    <input type="file" id="videoInput" accept="video/*" style="display: none;" />
    
    <!-- 巨大なアップロードボタン（中央配置） -->
    <div class="main-upload-area">
      <button id="selectVideoBtn" class="giant-upload-btn">
        <div class="btn-icon">📹</div>
        <div class="btn-text">…別に、アンタの動画を<br>解析してやってもいいけど？</div>
        <div class="btn-hint">10秒以内・100MB以内</div>
      </button>
    </div>
    
    <!-- プレビューエリア（最小限） -->
    <div id="videoPreview" class="video-preview" style="display: none;"></div>
    
    <!-- 進捗表示（ツンデレ風） -->
    <div id="uploadProgress" class="upload-progress" style="display: none;"></div>
  `
  actionContainer.appendChild(uploadSection)
  
  // イベントリスナー設定
  const videoInput = document.getElementById('videoInput')
  const selectBtn = document.getElementById('selectVideoBtn')
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
      alert('…チッ、100MB以下の動画を選択しろよ。大きすぎて解析できやしないわ。10秒以内、100MB以内に収めてなさい。')
      return
    }
    
    // プレビュー表示（読み込み中表示・ツンデレ風）
    previewDiv.innerHTML = `
      <div style="padding: 20px; background: rgba(0, 0, 0, 0.4); border-radius: 12px; text-align: center; border: 2px solid rgba(255, 107, 157, 0.5);">
        <div style="font-size: 1.2rem; margin-bottom: 10px;">💭</div>
        <div style="font-size: 0.9rem; color: #ff6b9d; margin-bottom: 10px; font-family: 'Courier New', monospace;">
          …ちょっと待ちなさい。今、動画を確認してるんだから。
        </div>
      </div>
    `
    previewDiv.style.display = 'block'
    selectBtn.disabled = true
    selectBtn.classList.add('loading-state')
    selectedFile = null
    
    // 動画の長さをチェック（10秒制限）
    const video = document.createElement('video')
    video.src = URL.createObjectURL(file)
    video.controls = true
    video.style.cssText = 'width: 100%; max-height: 300px; border-radius: 8px; margin-top: 1rem;'
    
    // 動画のメタデータ読み込みを待つ
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('動画のメタデータ読み込みがタイムアウトしました'))
      }, 10000) // 10秒タイムアウト
      
      video.addEventListener('loadedmetadata', () => {
        clearTimeout(timeout)
        resolve()
      }, { once: true })
      
      video.addEventListener('error', (e) => {
        clearTimeout(timeout)
        reject(new Error('動画ファイルの読み込みに失敗しました'))
      }, { once: true })
      
      // メタデータ読み込みを開始
      video.load()
    }).then(() => {
      // メタデータ読み込み成功
      const duration = video.duration
      
      if (isNaN(duration) || duration <= 0) {
        alert('…この動画、読めないわ。別の動画を選びなさい。')
        videoInput.value = ''
        previewDiv.innerHTML = ''
        previewDiv.style.display = 'none'
        selectBtn.disabled = false
        selectBtn.classList.remove('loading-state')
        selectedFile = null
        return
      }
      
      if (duration > 10) {
        alert(`…チッ、長すぎるわよ！\n\n今の動画: ${duration.toFixed(1)}秒\n10秒以内に収めなさい。…別に、アンタのために言ってるわけじゃないからね。`)
        videoInput.value = ''
        previewDiv.innerHTML = ''
        previewDiv.style.display = 'none'
        selectBtn.disabled = false
        selectBtn.classList.remove('loading-state')
        selectedFile = null
        return
      }
      
      // 動画の長さがOKなら、ファイルを選択状態にする
      selectedFile = file
      
      // プレビュー表示を更新（ツンデレ風）
      previewDiv.innerHTML = ''
      previewDiv.appendChild(video)
      
      // ファイル情報表示（ツンデレ風）
      const fileInfo = document.createElement('div')
      fileInfo.style.cssText = 'margin-top: 1rem; padding: 15px; background: rgba(255, 107, 157, 0.15); border-radius: 12px; border: 2px solid rgba(255, 107, 157, 0.4); font-family: "Courier New", monospace;'
      fileInfo.innerHTML = `
        <div style="font-size: 1rem; color: #ff6b9d; margin-bottom: 8px; text-align: center;">
          …まあ、この動画なら解析してやってもいいわよ
        </div>
        <div style="font-size: 0.85rem; color: #fff; opacity: 0.9; text-align: center; margin-bottom: 10px;">
          ${escapeHtml(file.name)}<br>
          ${(file.size / 1024 / 1024).toFixed(2)}MB・${duration.toFixed(1)}秒
        </div>
        <div style="text-align: center;">
          <button id="uploadBtn" class="giant-upload-btn" style="width: auto; height: auto; padding: 12px 32px; border-radius: 25px; font-size: 1rem;">
            <div class="btn-icon" style="font-size: 1.5rem;">🚀</div>
            <div class="btn-text" style="font-size: 0.9rem;">…解析してもいいわよ</div>
          </button>
        </div>
      `
      previewDiv.appendChild(fileInfo)
      
      selectBtn.disabled = false
      selectBtn.classList.remove('loading-state')
      
      // 解析開始ボタンのイベントを設定
      const uploadBtn = document.getElementById('uploadBtn')
      if (uploadBtn && !uploadBtn.hasAttribute('data-listener-added')) {
        uploadBtn.setAttribute('data-listener-added', 'true')
        uploadBtn.addEventListener('click', () => handleUpload(selectedFile, userId, progressDiv, previewDiv))
      }
      
    }).catch((error) => {
      // エラー時
      console.error('動画読み込みエラー:', error)
      alert(`動画ファイルの読み込みに失敗しました: ${error.message}\n\n別の動画を選択してください。`)
      videoInput.value = ''
      previewDiv.innerHTML = ''
      previewDiv.style.display = 'none'
      uploadBtn.style.display = 'none'
      selectedFile = null
    })
    
    // ステップガイドを更新
    const stepsGuide = document.getElementById('stepsGuide')
    if (stepsGuide) {
      stepsGuide.innerHTML = `
        <div style="font-size: 0.9rem; font-weight: bold; color: #64ff64; margin-bottom: 10px;">
          ✅ ステップ①完了：動画を選びました
        </div>
        <div style="font-size: 0.85rem; line-height: 1.8; color: #fff;">
          <div style="margin-bottom: 8px;">
            <strong style="color: #64c8ff;">次のステップ：</strong>
          </div>
          <div style="margin-bottom: 8px; padding-left: 15px;">
            👇 一番下の「🚀 解析開始」ボタンを押してください
          </div>
          <div style="font-size: 0.75rem; color: #ff9800; margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.2);">
            💡 解析開始を押すと、自動でアップロード→解析が始まって、結果がLINEで届くわよ。<br>
            <span style="color: #ff6464; font-weight: bold;">⚠️ 動画は10秒以内、100MB以内に収めてなさいよ。</span>
          </div>
        </div>
      `
    }
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
            …解析を開始するわよ。動画をアップロードして、AIKA18号のバトルスコープで解析するから、ちょっと待ちなさい。
          </div>
        </div>
      `
    
    try {
      // 認証状態を確認（開発モード・本番モード両方に対応）
      let actualUserId = userId
      
      // 開発モードの場合
      if (LIFF_CONFIG.isDevMode) {
        const { auth } = await import('./firebase.js')
        if (!auth.currentUser) {
          // 匿名認証が完了するまで待つ（タイムアウト延長：15秒）
          await new Promise((resolve) => {
            let resolved = false
            const unsubscribe = auth.onAuthStateChanged((user) => {
              if (user && !resolved) {
                resolved = true
                unsubscribe()
                actualUserId = user.uid
                console.log('✅ 開発モード: 匿名認証成功:', actualUserId)
                resolve()
              }
            })
            // タイムアウト（15秒に延長）
            setTimeout(() => {
              if (!resolved) {
                resolved = true
                unsubscribe()
                console.warn('⚠️ 開発モード: 認証タイムアウト（15秒）')
                // タイムアウト後も続行を試みる
                if (auth.currentUser) {
                  actualUserId = auth.currentUser.uid
                }
                resolve()
              }
            }, 15000)
          })
        } else {
          actualUserId = auth.currentUser.uid
        }
        console.log('🔧 開発モード: 実際のユーザーID:', actualUserId)
      } else {
        // 本番モード（LINE認証）の場合
        // userIdが正しく取得されているか確認
        if (!userId || userId === 'test_user') {
          console.warn('⚠️ LINE認証: userIdが取得できていません。再取得を試みます...')
          
          // LIFFが利用可能か確認
          if (typeof liff === 'undefined' || !liff.isLoggedIn()) {
            console.error('❌ LIFFが利用できません。LINEアプリ内で開いているか確認してください。')
            throw new Error('LINE認証が必要です。LINEアプリ内で開いてください。')
          }
          
          // LIFFプロファイルを再取得（リトライ付き）
          let profileRetrieved = false
          for (let retry = 0; retry < 3; retry++) {
            try {
              const profile = await liff.getProfile()
              if (profile && profile.userId) {
                actualUserId = profile.userId
                profileRetrieved = true
                console.log('✅ LINE認証成功:', actualUserId)
                break
              }
            } catch (error) {
                console.warn(`⚠️ LIFFプロファイル取得失敗 (試行 ${retry + 1}/3):`, error)
                if (retry < 2) {
                  // 1秒待って再試行
                  await new Promise(resolve => setTimeout(resolve, 1000))
                }
              }
            }
            
            if (!profileRetrieved) {
              console.error('❌ LINE認証: プロファイル取得に失敗しました')
              throw new Error('認証タイムアウト: LINEアプリ内でページを再読み込みしてください。')
            }
          } else {
            // userIdが既に取得されている場合、そのまま使用
            actualUserId = userId
            console.log('✅ LINE認証: userIdを使用:', actualUserId)
          }
        }
      
      // 進捗監視（アップロード開始前に設定）
      const progressHandler = (e) => {
        const progress = e.detail.progress || 0
        console.log('📊 進捗更新:', progress + '%')
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
      }
      window.addEventListener('uploadProgress', progressHandler)
      
      // 初期進捗を表示（0%）
      progressHandler({ detail: { progress: 0 } })
      
      console.log('🚀 アップロード開始:', {
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        userId: actualUserId,
        isDevMode: LIFF_CONFIG.isDevMode
      })
      
      // Firebase Storageにアップロード
      const downloadURL = await uploadVideoToStorage(selectedFile, actualUserId)
      
      // 進捗イベントリスナーを削除
      window.removeEventListener('uploadProgress', progressHandler)
      
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
      
      // エラーの詳細情報
      let errorMessage = error.message || '何か問題が発生したわ'
      
      // 開発モードで認証エラーの場合、より詳細なメッセージ
      if (LIFF_CONFIG.isDevMode && error.message && error.message.includes('auth')) {
        errorMessage = 'Firebase認証エラー: 開発モードで認証に失敗しました。コンソールを確認してください。'
        console.error('🔧 開発モード認証エラー詳細:', error)
      }
      
      progressDiv.innerHTML = `
        <div style="background: rgba(0, 0, 0, 0.4); border-radius: 8px; padding: 15px; margin-top: 1rem; border: 2px solid rgba(255, 100, 100, 0.5); font-family: 'Courier New', monospace;">
          <div style="font-size: 0.75rem; color: #ff6464; margin-bottom: 8px; text-align: left;">
            ▸ ERROR DETECTED
          </div>
          <div style="font-size: 0.85rem; color: #fff; margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255, 100, 100, 0.3);">
            …チッ、エラーよ。<br>
            <span style="font-size: 0.8rem; color: #ff9800; margin-top: 5px; display: block;">
              ${escapeHtml(errorMessage)}
            </span>
            <span style="font-size: 0.75rem; color: #64c8ff; margin-top: 8px; display: block;">
              もう一度やり直しなさい。
            </span>
            ${LIFF_CONFIG.isDevMode ? '<span style="font-size: 0.7rem; color: #ff9800; margin-top: 8px; display: block;">💡 開発モード: F12でコンソールを開いてエラー詳細を確認してください。</span>' : ''}
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

