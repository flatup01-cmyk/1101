import { initializeApp } from 'firebase/app';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { FIREBASE_CONFIG } from './config.js';

// --- Firebase Initialization ---
const app = initializeApp(FIREBASE_CONFIG);
const storage = getStorage(app);
const auth = getAuth(app);
const firestore = getFirestore(app);

console.log('✅ Firebase Core Services Initialized');

/**
 * Anonymous Auth - 匿名認証を確実に実行
 */
async function ensureAnonymousAuth() {
    if (!auth.currentUser) {
        try {
            await signInAnonymously(auth);
            console.log('✅ Anonymous Auth Success');
            console.log(`📋 Current user: ${auth.currentUser?.uid || 'none'}`);
            return true;
        } catch (error) {
            console.error('❌ Anonymous Auth Failed', error);
            throw new Error('認証に失敗しました。ネットワークを確認して再度お試しください。');
        }
    }
    return true;
}

/**
 * Initialize Firebase with anonymous authentication
 */
export async function initFirebase() {
    try {
        // 匿名認証を確実に実行
        await ensureAnonymousAuth();
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
            userId: userId, // LIFF User ID
            firebaseUid: auth.currentUser?.uid || null, // Firebase UID
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

    // 0. 認証を確認（未認証の場合は認証を実行）
    if (!auth.currentUser) {
        console.log('⚠️ 認証されていないため、匿名認証を実行します...');
        await ensureAnonymousAuth();
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
    // Firebase UIDを使用してパスを構築（Storage Rulesとの整合性を保つ）
    const firebaseUid = auth.currentUser.uid;
    const storagePath = `videos/${firebaseUid}/${jobId}/${videoFile.name}`;
    const storageRef = ref(storage, storagePath);

    console.log(`🚀 Starting upload for job ${jobId} to ${storagePath}`);
    console.log(`📋 Firebase UID: ${firebaseUid}`);
    console.log(`📋 LIFF User ID: ${userId}`);
    console.log(`📋 Auth provider: ${auth.currentUser?.providerData?.[0]?.providerId || 'anonymous'}`);

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

