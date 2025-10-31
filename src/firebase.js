// Firebase初期化とStorage操作
import { initializeApp } from 'firebase/app'
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { FIREBASE_CONFIG } from './config.js'

// Firebase初期化
const app = initializeApp(FIREBASE_CONFIG)
export const storage = getStorage(app)

/**
 * 動画ファイルをFirebase Storageにアップロード
 * @param {File} videoFile - アップロードする動画ファイル
 * @param {string} userId - LINEユーザーID
 * @returns {Promise<string>} - アップロード完了後のダウンロードURL
 */
export async function uploadVideoToStorage(videoFile, userId) {
  try {
    // ファイル名を生成: {timestamp}-{originalFilename}
    const timestamp = Date.now()
    const originalFilename = videoFile.name
    const fileName = `${timestamp}-${originalFilename}`
    
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

