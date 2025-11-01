// Firebase初期化とStorage操作
import { initializeApp } from 'firebase/app'
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { getAuth, signInAnonymously } from 'firebase/auth'
import { FIREBASE_CONFIG, LIFF_CONFIG } from './config.js'

// Firebase設定の検証
if (!FIREBASE_CONFIG.apiKey || FIREBASE_CONFIG.apiKey.length < 10) {
  console.error('❌ Firebase APIキーが設定されていません')
  console.error('Netlifyの環境変数 VITE_FIREBASE_API_KEY を確認してください')
}

// Firebase初期化
let app
let storage
let auth

try {
  app = initializeApp(FIREBASE_CONFIG)
  storage = getStorage(app)
  auth = getAuth(app)
  console.log('✅ Firebase初期化成功')
} catch (error) {
  console.error('❌ Firebase初期化失敗:', error)
  throw error
}

export { storage, auth }

// 開発モードでFirebase匿名認証を実行
if (LIFF_CONFIG.isDevMode) {
  // Firebase設定の詳細をログ出力（デバッグ用）
  console.log('🔍 Firebase設定確認:', {
    apiKey: FIREBASE_CONFIG.apiKey ? `${FIREBASE_CONFIG.apiKey.substring(0, 10)}...` : '未設定',
    authDomain: FIREBASE_CONFIG.authDomain,
    projectId: FIREBASE_CONFIG.projectId,
    hasAuth: !!auth
  })
  
  // 少し遅延させてから認証（Firebase初期化が確実に完了してから）
  setTimeout(() => {
    if (!auth) {
      console.error('❌ Firebase Authが初期化されていません')
      return
    }
    
    if (!auth.currentUser) {
      console.log('🔐 匿名認証を開始...')
      signInAnonymously(auth)
        .then(() => {
          console.log('✅ 開発モード: Firebase匿名認証成功')
          console.log('ユーザーID:', auth.currentUser.uid)
        })
        .catch((error) => {
          console.error('❌ 開発モード: Firebase匿名認証失敗:', error)
          console.error('エラー詳細:', {
            code: error.code,
            message: error.message,
            stack: error.stack
          })
          
          // エラーコードに応じた解決方法を表示
          if (error.code === 'auth/api-key-not-valid') {
            console.error('💡 解決方法: Netlifyの環境変数 VITE_FIREBASE_API_KEY を確認してください')
          } else if (error.code === 'auth/configuration-not-found') {
            console.error('💡 解決方法: Firebase Console → Authentication → Sign-in method で「匿名」を有効にしてください')
            console.error('💡 URL: https://console.firebase.google.com/project/aikaapp-584fa/authentication/providers')
          } else if (error.code === 'auth/operation-not-allowed') {
            console.error('💡 解決方法: Firebase Console → Authentication → Sign-in method で匿名認証が有効になっているか確認してください')
          } else {
            console.error('💡 一般的な解決方法:')
            console.error('   1. Firebase Console → Authentication → Sign-in method で「匿名」を有効化')
            console.error('   2. Google Cloud Console で Identity Toolkit API が有効か確認')
            console.error('   3. Netlifyの環境変数が正しく設定されているか確認')
          }
        })
    } else {
      console.log('✅ 既に認証済み:', auth.currentUser.uid)
    }
  }, 1000) // 遅延を1秒に延長
}

/**
 * 動画ファイルをFirebase Storageにアップロード
 * @param {File} videoFile - アップロードする動画ファイル
 * @param {string} userId - LINEユーザーID
 * @returns {Promise<string>} - アップロード完了後のダウンロードURL
 */
export async function uploadVideoToStorage(videoFile, userId) {
  try {
    console.log('📤 アップロード準備:', { userId, fileName: videoFile.name, fileSize: videoFile.size })
    
    // 認証状態を確認
    if (auth.currentUser) {
      console.log('✅ 認証済み:', auth.currentUser.uid)
    } else {
      console.warn('⚠️ 認証されていません。開発モードの場合、匿名認証を待機中...')
      // 認証を待つ（開発モードの場合）
      await new Promise((resolve, reject) => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
          if (user) {
            unsubscribe()
            console.log('✅ 匿名認証完了:', user.uid)
            resolve()
          }
        })
        setTimeout(() => {
          unsubscribe()
          reject(new Error('認証タイムアウト'))
        }, 10000)
      })
    }
    
    // セキュリティ: userIdの検証（英数字、ハイフン、アンダースコアのみ）
    if (!userId || !/^[a-zA-Z0-9_-]+$/.test(userId)) {
      throw new Error('不正なユーザーIDです')
    }
    
    // セキュリティ: ファイル名の検証（パストラバーサル対策）
    const originalFilename = videoFile.name || 'video.mp4'
    // 危険な文字を除去（../など）
    const sanitizedFilename = originalFilename.replace(/[^a-zA-Z0-9._-]/g, '_')
    // ファイル名の長さ制限
    const safeFilename = sanitizedFilename.length > 100 ? sanitizedFilename.substring(0, 100) : sanitizedFilename
    
    // ファイル名を生成: {timestamp}-{originalFilename}
    const timestamp = Date.now()
    const fileName = `${timestamp}-${safeFilename}`
    
    // ストレージパス: videos/{userID}/{timestamp}-{filename}
    const storagePath = `videos/${userId}/${fileName}`
    const storageRef = ref(storage, storagePath)
    
    console.log('📁 ストレージパス:', storagePath)
    
    // アップロード実行
    console.log('🔄 アップロードタスク開始...')
    const uploadTask = uploadBytesResumable(storageRef, videoFile)
    
    // Promiseでラップして進捗を監視可能にする
    return new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          // 進捗を更新
          const progress = snapshot.totalBytes > 0 
            ? (snapshot.bytesTransferred / snapshot.totalBytes) * 100 
            : 0
          console.log(`📊 アップロード進捗: ${Math.round(progress)}% (${snapshot.bytesTransferred}/${snapshot.totalBytes})`)
          
          // 進捗イベントを発火
          const event = new CustomEvent('uploadProgress', { 
            detail: { progress, snapshot } 
          })
          window.dispatchEvent(event)
        },
        (error) => {
          console.error('❌ アップロードエラー:', error)
          console.error('エラー詳細:', {
            code: error.code,
            message: error.message,
            serverResponse: error.serverResponse
          })
          reject(error)
        },
        async () => {
          // アップロード成功
          console.log('✅ アップロード完了')
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)
          console.log('📥 ダウンロードURL:', downloadURL)
          resolve(downloadURL)
        }
      )
    })
  } catch (error) {
    console.error('❌ Firebase Storage アップロード失敗:', error)
    throw error
  }
}

