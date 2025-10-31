// AIKA Battle Scouter - メインエントリーポイント
import './style.css'
import liff from '@line/liff'
import { LIFF_CONFIG } from './config.js'

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
  
  // ここに動画アップロード機能を実装予定
  // TODO: 動画アップロードUIの実装
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

