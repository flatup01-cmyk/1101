import { initializeApp } from 'firebase/app';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { FIREBASE_CONFIG } from './config.js';

// --- Firebase Initialization ---
const app = initializeApp(FIREBASE_CONFIG);
const storage = getStorage(app);
const auth = getAuth(app);
const firestore = getFirestore(app);

console.log('✅ Firebase Core Services Initialized');

/**
 * Initialize Firebase and ensure authentication
 * モバイル環境でも匿名認証を実行してFirestore/Storageへのアクセスを可能にする
 */
export async function initFirebase() {
    // Firebase is already initialized above
    
    // 認証状態を確認して、未認証の場合は匿名認証を実行
    if (!auth.currentUser) {
        try {
            console.log('🔐 認証されていないため、匿名認証を開始します...');
            await signInAnonymously(auth);
            console.log('✅ Firebase匿名認証成功 - UID:', auth.currentUser?.uid);
        } catch (error) {
            console.error('❌ Firebase匿名認証失敗:', error);
            console.error('Error details:', {
                code: error.code,
                message: error.message,
                name: error.name
            });
            throw new Error(`Firebase認証に失敗しました: ${error.message}`);
        }
    } else {
        console.log('✅ Firebase認証済み - UID:', auth.currentUser.uid);
    }
    
    return Promise.resolve();
}

/**
 * Creates a new video processing job document in Firestore.
 * @param {string} userId - The user's ID.
 * @param {string} fileName - The name of the video file.
 * @returns {Promise<string>} - The unique ID of the created job.
 */
/**
 * Waits for authentication to complete
 * @returns {Promise<void>}
 */
async function waitForAuth() {
    if (auth.currentUser) {
        return Promise.resolve();
    }
    
    return new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            unsubscribe();
            if (user) {
                console.log('✅ Auth state changed - user authenticated:', user.uid);
                resolve();
            } else {
                reject(new Error('認証が完了しませんでした'));
            }
        });
        
        // タイムアウト: 10秒
        setTimeout(() => {
            unsubscribe();
            reject(new Error('認証のタイムアウト'));
        }, 10000);
    });
}

async function createVideoJob(userId, fileName) {
    try {
        // 認証状態を確実に確認
        console.log('🔐 認証状態を確認中...');
        console.log('   現在の認証状態:', auth.currentUser ? `認証済み (UID: ${auth.currentUser.uid})` : '未認証');
        
        // 認証されていない場合は匿名認証を実行
        if (!auth.currentUser) {
            console.log('🔐 匿名認証を開始します...');
            try {
                await signInAnonymously(auth);
                console.log('✅ 匿名認証成功 - UID:', auth.currentUser?.uid);
            } catch (error) {
                console.error('❌ 匿名認証失敗:', error);
                throw new Error('Firebase認証に失敗しました。ページを再読み込みしてください。');
            }
        }
        
        // 認証状態が確実に設定されるまで待機
        await waitForAuth();
        
        if (!auth.currentUser) {
            throw new Error('認証が完了していません。ページを再読み込みしてください。');
        }
        
        console.log(`📝 Creating job for user: ${userId}, file: ${fileName}`);
        console.log(`🔐 Current auth UID: ${auth.currentUser?.uid}`);
        console.log(`🔐 Auth state: ${auth.currentUser ? 'authenticated' : 'not authenticated'}`);
        
        // タイムアウト付きでFirestoreジョブを作成（モバイル環境対応）
        const jobsCollection = collection(firestore, 'video_jobs');
        const createPromise = addDoc(jobsCollection, {
            userId: userId,
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
            name: error.name,
            authState: auth.currentUser ? 'authenticated' : 'not authenticated',
            authUID: auth.currentUser?.uid
        });
        
        // より詳細なエラーメッセージ
        if (error.message.includes('タイムアウト')) {
            throw new Error("解析ジョブの作成がタイムアウトしました。ネットワークを確認して、もう一度お試しください。");
        } else if (error.code === 'permission-denied') {
            console.error('❌ Permission denied - 認証状態の詳細:', {
                hasAuth: !!auth.currentUser,
                authUID: auth.currentUser?.uid,
                userId: userId,
                fileName: fileName
            });
            throw new Error("解析ジョブの作成権限がありません。ページを再読み込みしてください。");
        } else if (error.code === 'unauthenticated') {
            throw new Error("認証が必要です。ページを再読み込みしてください。");
        } else {
            throw new Error("解析ジョブの作成に失敗しました。やり直してください。");
        }
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
        console.error('❌ Invalid userId:', userId);
        throw new Error('不正なユーザーIDです。');
    }

    // 認証状態を確認
    if (!auth.currentUser) {
        console.warn('⚠️ 認証されていないため、匿名認証を再試行します...');
        try {
            await signInAnonymously(auth);
            console.log('✅ 匿名認証成功 - UID:', auth.currentUser?.uid);
        } catch (error) {
            console.error('❌ 匿名認証失敗:', error);
            throw new Error('Firebase認証に失敗しました。ページを再読み込みしてください。');
        }
    }

    console.log(`📤 Upload request - User: ${userId}, File: ${videoFile.name}, Size: ${(videoFile.size / 1024 / 1024).toFixed(2)}MB`);
    console.log(`🔐 Current auth UID: ${auth.currentUser?.uid}`);

    // 1. Create a job document in Firestore first.
    let jobId;
    try {
        jobId = await createVideoJob(userId, videoFile.name);
    } catch (error) {
        console.error('❌ Job creation failed:', error);
        throw error; // エラーをそのまま伝播
    }

    // 2. Define the storage path using the job ID for integrity.
    const storagePath = `videos/${userId}/${jobId}/${videoFile.name}`;
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

