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
 * Initialize Firebase (for compatibility)
 */
export async function initFirebase() {
    // Firebase is already initialized above
    // This function exists for compatibility with main.js
    return Promise.resolve();
}

/**
 * Firebase Anonymous認証を実行（LIFF認証後、必ず実行）
 * Firestoreのセキュリティルールで認証が必要なため、本番環境でも必須
 */
export async function ensureFirebaseAuth() {
    try {
        // 既に認証済みの場合はスキップ
        if (auth.currentUser) {
            console.log('✅ Firebase認証済み:', auth.currentUser.uid);
            return auth.currentUser;
        }

        // 匿名認証を実行
        console.log('🔐 Firebase Anonymous認証を開始...');
        const userCredential = await signInAnonymously(auth);
        console.log('✅ Firebase Anonymous認証成功:', userCredential.user.uid);
        return userCredential.user;
    } catch (error) {
        console.error('❌ Firebase Anonymous認証失敗:', error);
        throw new Error('Firebase認証に失敗しました。もう一度お試しください。');
    }
}

// --- Anonymous Auth for Dev Mode ---
if (import.meta.env.DEV) {
    if (!auth.currentUser) {
        signInAnonymously(auth)
            .then(() => console.log('✅ Dev Mode: Anonymous Auth Success'))
            .catch(error => console.error('❌ Dev Mode: Anonymous Auth Failed', error));
    }
}

/**
 * Creates a new video processing job document in Firestore.
 * @param {string} userId - The Firebase Anonymous Auth user ID.
 * @param {string} lineUserId - The LINE user ID (from LIFF).
 * @param {string} fileName - The name of the video file.
 * @returns {Promise<string>} - The unique ID of the created job.
 */
async function createVideoJob(userId, lineUserId, fileName) {
    try {
        console.log(`📝 Creating job for user: ${userId}, lineUserId: ${lineUserId}, file: ${fileName}`);
        
        // タイムアウト付きでFirestoreジョブを作成（モバイル環境対応）
        const jobsCollection = collection(firestore, 'video_jobs');
        const createPromise = addDoc(jobsCollection, {
            userId: userId,
            lineUserId: lineUserId, // LINEユーザーIDを保存
            originalFileName: fileName,
            status: 'pending', // pending -> processing -> completed / error
            createdAt: serverTimestamp(),
            retries: 0,
        });
        
        // 30秒タイムアウト
        const docRef = await Promise.race([
            createPromise,
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Firestore接続タイムアウト')), 30000)
            )
        ]);
        
        console.log(`✅ Job created in Firestore with ID: ${docRef.id}`);
        return docRef.id;
    } catch (error) {
        console.error('❌ Failed to create Firestore job:', error);
        console.error('Error details:', {
            code: error.code,
            message: error.message,
            name: error.name
        });
        
        // より詳細なエラーメッセージ
        if (error.message.includes('タイムアウト')) {
            throw new Error("解析ジョブの作成がタイムアウトしました。ネットワークを確認して、もう一度お試しください。");
        } else if (error.code === 'permission-denied') {
            throw new Error("解析ジョブの作成権限がありません。LINEアプリでログインし直してください。");
        } else {
            throw new Error("解析ジョブの作成に失敗しました。やり直してください。");
        }
    }
}

/**
 * Uploads a video file to Firebase Storage, associated with a Firestore job.
 * @param {File} videoFile - The video file to upload.
 * @param {string} userId - The Firebase Anonymous Auth user ID.
 * @param {string} lineUserId - The LINE user ID (from LIFF).
 * @param {Function} progressCallback - Callback for upload progress updates.
 * @returns {Promise<void>}
 */
export async function uploadVideoToStorage(videoFile, userId, lineUserId, progressCallback) {
    const sanitizedUserId = typeof userId === 'string' ? userId.trim() : String(userId ?? '').trim();
    const sanitizedLineUserId = typeof lineUserId === 'string' ? lineUserId.trim() : String(lineUserId ?? '').trim();

    if (!sanitizedUserId) {
        console.error('❌ Invalid userId (empty):', userId);
        throw new Error('不正なユーザーIDです。LINEアプリでログインし直してください。');
    }

    if (!sanitizedLineUserId) {
        console.error('❌ Invalid lineUserId (empty):', lineUserId);
        throw new Error('LINEのユーザー情報を取得できませんでした。LINEアプリから開き直してください。');
    }

    // LINEユーザーIDは通常「U」から始まる32桁の16進数だが、開発モード等で異なる形式になる場合もある。
    // ここでは安全な文字のみ許可しつつ、幅広いケースに対応する。
    const safeIdPattern = /^[a-zA-Z0-9_\-]+$/;
    if (!safeIdPattern.test(sanitizedLineUserId)) {
        console.error('❌ Invalid lineUserId (unsafe characters):', sanitizedLineUserId);
        throw new Error('不正なLINEユーザーIDです。LINEアプリでログインし直してください。');
    }

    console.log(`📤 Upload request - User: ${sanitizedUserId}, LineUser: ${sanitizedLineUserId}, File: ${videoFile.name}, Size: ${(videoFile.size / 1024 / 1024).toFixed(2)}MB`);

    // 1. Create a job document in Firestore first.
    let jobId;
    try {
        jobId = await createVideoJob(sanitizedUserId, sanitizedLineUserId, videoFile.name);
    } catch (error) {
        console.error('❌ Job creation failed:', error);
        throw error; // エラーをそのまま伝播
    }

    // 2. Define the storage path using the job ID for integrity.
    const storagePath = `videos/${sanitizedUserId}/${jobId}/${videoFile.name}`;
    const storageRef = ref(storage, storagePath);

    console.log(`🚀 Starting upload for job ${jobId} to ${storagePath}`);

    // 3. Execute the upload.
    const uploadTask = uploadBytesResumable(storageRef, videoFile);

    return new Promise((resolve, reject) => {
        let lastProgress = 0;
        
        uploadTask.on(
            'state_changed',
            (snapshot) => {
                const progress = snapshot.totalBytes > 0
                    ? (snapshot.bytesTransferred / snapshot.totalBytes) * 100
                    : 0;
                
                // 進捗ログ（10%刻みで）
                if (Math.floor(progress / 10) > Math.floor(lastProgress / 10)) {
                    console.log(`📊 Upload progress: ${Math.floor(progress)}%`);
                    lastProgress = progress;
                }
                
                if (progressCallback) progressCallback(progress);
            },
            (error) => {
                console.error(`❌ Upload failed for job ${jobId}:`, error);
                console.error('Upload error details:', {
                    code: error.code,
                    message: error.message,
                    serverResponse: error.serverResponse
                });
                
                // より詳細なエラーメッセージ
                let errorMessage = "動画のアップロードに失敗しました。";
                
                if (error.code === 'storage/unauthorized') {
                    errorMessage = "アップロード権限がありません。LINEアプリでログインし直してください。";
                } else if (error.code === 'storage/canceled') {
                    errorMessage = "アップロードがキャンセルされました。";
                } else if (error.code === 'storage/quota-exceeded') {
                    errorMessage = "ストレージの容量が不足しています。";
                } else if (error.code === 'storage/retry-limit-exceeded') {
                    errorMessage = "アップロードのリトライ回数を超えました。ネットワークを確認してください。";
                } else {
                    errorMessage = "動画のアップロードに失敗しました。ネットワークを確認してやり直してください。";
                }
                
                reject(new Error(errorMessage));
            },
            async () => {
                console.log(`✅ Upload complete for job ${jobId}`);
                // Here you could update the Firestore job status to 'uploaded'
                resolve();
            }
        );
    });
}

