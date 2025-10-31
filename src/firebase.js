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
    
    // アップロード実行
    const uploadTask = uploadBytesResumable(storageRef, videoFile)
    
    // Promiseでラップして進捗を監視可能にする
    return new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          // 進捗を更新（オプション）
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          console.log(`アップロード進捗: ${Math.round(progress)}%`)
          
          // 必要に応じて進捗イベントを発火
          const event = new CustomEvent('uploadProgress', { 
            detail: { progress, snapshot } 
          })
          window.dispatchEvent(event)
        },
        (error) => {
          console.error('アップロードエラー:', error)
          reject(error)
        },
        async () => {
          // アップロード成功
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)
          console.log('アップロード成功:', downloadURL)
          resolve(downloadURL)
        }
      )
    })
  } catch (error) {
    console.error('Firebase Storage アップロード失敗:', error)
    throw error
  }
}

