import { initializeApp } from 'firebase/app';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { getAuth, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { FIREBASE_CONFIG, CLOUD_FUNCTIONS_CONFIG } from './config.js';

// --- Firebase Initialization ---
const app = initializeApp(FIREBASE_CONFIG);
const storage = getStorage(app);
const auth = getAuth(app);
const firestore = getFirestore(app);

console.log('✅ Firebase Core Services Initialized');

/**
 * LIFF IDトークンをFirebaseカスタムトークンに交換する
 * @param {string} liffIdToken - LIFFのIDトークン
 * @returns {Promise<string>} - Firebaseカスタムトークン
 */
async function exchangeLiffTokenForCustomToken(liffIdToken) {
    try {
        const response = await fetch(CLOUD_FUNCTIONS_CONFIG.exchangeTokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                idToken: liffIdToken
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data.customToken;
    } catch (error) {
        console.error('❌ LIFFトークン交換エラー:', error);
        throw new Error(`認証トークンの交換に失敗しました: ${error.message}`);
    }
}

/**
 * Initialize Firebase with LIFF authentication
 * @param {string} liffIdToken - LIFFのIDトークン
 */
export async function initFirebase(liffIdToken) {
    try {
        // 開発モードの場合は匿名認証を使用
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('dev') === 'true' || import.meta.env.DEV) {
            console.log('🔧 Development mode: Using anonymous auth');
            // 開発モードでは匿名認証をスキップ（Firebase Admin SDKがない場合の代替）
            return Promise.resolve();
        }

        if (!liffIdToken) {
            throw new Error('LIFF IDトークンが提供されていません');
        }

        // LIFF IDトークンをFirebaseカスタムトークンに交換
        console.log('🔄 Exchanging LIFF token for Firebase custom token...');
        const customToken = await exchangeLiffTokenForCustomToken(liffIdToken);
        
        // Firebaseカスタムトークンでサインイン
        console.log('🔐 Signing in with custom token...');
        await signInWithCustomToken(auth, customToken);
        
        console.log('✅ Firebase authentication successful');
        console.log(`📋 Current user: ${auth.currentUser?.uid || 'none'}`);
        
        return Promise.resolve();
    } catch (error) {
        console.error('❌ Firebase initialization failed:', error);
        throw error;
    }
}

/**
 * Creates a new video processing job document in Firestore.
 * @param {string} userId - The user's ID.
 * @param {string} fileName - The name of the video file.
 * @returns {Promise<string>} - The unique ID of the created job.
 */
async function createVideoJob(userId, fileName) {
    try {
        const jobsCollection = collection(firestore, 'video_jobs');
        const docRef = await addDoc(jobsCollection, {
            userId: userId,
            originalFileName: fileName,
            status: 'pending', // pending -> processing -> completed / error
            createdAt: serverTimestamp(),
            retries: 0,
        });
        console.log(`✅ Job created in Firestore with ID: ${docRef.id}`);
        return docRef.id;
    } catch (error) {
        console.error('❌ Failed to create Firestore job', error);
        throw new Error("解析ジョブの作成に失敗しました。やり直してください。");
    }
}

/**
 * Uploads a video file to Firebase Storage, associated with a Firestore job.
 * @param {File} videoFile - The video file to upload.
 * @param {string} userId - The user's ID.
 * @param {Function} progressCallback - Callback for upload progress updates.
 * @returns {Promise<void>}
 */
export async function uploadVideoToStorage(videoFile, userId, progressCallback) {
    if (!userId || !/^[a-zA-Z0-9_-]+$/.test(userId)) {
        throw new Error('不正なユーザーIDです。');
    }

    // 0. 認証を確認（未認証の場合はエラー）
    if (!auth.currentUser) {
        throw new Error('認証が必要です。ページを再読み込みしてお試しください。');
    }

    // 1. Create a job document in Firestore first.
    let jobId;
    try {
        jobId = await createVideoJob(userId, videoFile.name);
    } catch (error) {
        console.error('❌ Firestore job creation failed:', error);
        // エラーメッセージをそのまま伝播
        throw error;
    }

    // 2. Define the storage path using the job ID for integrity.
    const storagePath = `videos/${userId}/${jobId}/${videoFile.name}`;
    const storageRef = ref(storage, storagePath);

    console.log(`🚀 Starting upload for job ${jobId} to ${storagePath}`);
    console.log(`📋 Current user: ${auth.currentUser?.uid || 'none'}`);
    console.log(`📋 Auth provider: ${auth.currentUser?.providerData?.[0]?.providerId || 'none'}`);

    // 3. Execute the upload.
    const uploadTask = uploadBytesResumable(storageRef, videoFile);

    return new Promise((resolve, reject) => {
        // タイムアウト設定（5分）
        const timeoutId = setTimeout(() => {
            uploadTask.cancel();
            reject(new Error('アップロードがタイムアウトしました。ネットワークを確認して再度お試しください。'));
        }, 5 * 60 * 1000);

        uploadTask.on(
            'state_changed',
            (snapshot) => {
                const progress = snapshot.totalBytes > 0
                    ? (snapshot.bytesTransferred / snapshot.totalBytes) * 100
                    : 0;
                if (progressCallback) progressCallback(progress);
            },
            (error) => {
                clearTimeout(timeoutId);
                console.error(`❌ Upload failed for job ${jobId}:`, error);
                
                // エラーの種類に応じてより具体的なメッセージを提供
                let errorMessage = "動画のアップロードに失敗しました。";
                
                if (error.code === 'storage/unauthorized') {
                    errorMessage = "認証エラーが発生しました。ページを再読み込みしてお試しください。";
                } else if (error.code === 'storage/canceled') {
                    errorMessage = "アップロードがキャンセルされました。";
                } else if (error.code === 'storage/quota-exceeded') {
                    errorMessage = "ストレージの容量が不足しています。";
                } else if (error.code === 'storage/unauthenticated') {
                    errorMessage = "認証が必要です。ページを再読み込みしてお試しください。";
                } else if (error.code === 'storage/retry-limit-exceeded') {
                    errorMessage = "ネットワークエラーが発生しました。ネットワークを確認して再度お試しください。";
                } else {
                    errorMessage = `アップロードに失敗しました: ${error.message}`;
                }
                
                reject(new Error(errorMessage));
            },
            async () => {
                clearTimeout(timeoutId);
                console.log(`✅ Upload complete for job ${jobId}`);
                // Here you could update the Firestore job status to 'uploaded'
                resolve();
            }
        );
    });
}

