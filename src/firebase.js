// Firebase初期化とStorage操作
import { initializeApp } from 'firebase/app'
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { getAuth, signInAnonymously } from 'firebase/auth'
import { FIREBASE_CONFIG, LIFF_CONFIG } from './config.js'

// Firebase初期化
const app = initializeApp(FIREBASE_CONFIG)
export const storage = getStorage(app)
export const auth = getAuth(app)

// 開発モードでFirebase匿名認証を実行
if (LIFF_CONFIG.isDevMode) {
  signInAnonymously(auth)
    .then(() => {
      console.log('✅ 開発モード: Firebase匿名認証成功')
    })
    .catch((error) => {
      console.error('❌ 開発モード: Firebase匿名認証失敗:', error)
    })
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

