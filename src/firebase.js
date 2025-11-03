import { initializeApp } from 'firebase/app';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, serverTimestamp, enableNetwork, disableNetwork } from 'firebase/firestore';
import { FIREBASE_CONFIG } from './config.js';

// --- Firebase Initialization ---
const app = initializeApp(FIREBASE_CONFIG);
const storage = getStorage(app);
const auth = getAuth(app);
const firestore = getFirestore(app);

console.log('✅ Firebase Core Services Initialized');

// --- Performance Metrics ---
const metrics = {
    authAttempts: 0,
    authSuccess: 0,
    authFailures: 0,
    firestoreOps: 0,
    storageOps: 0,
    startTime: Date.now()
};

// --- Network State Monitoring ---
let isOnline = navigator.onLine;
let networkListeners = [];

window.addEventListener('online', () => {
    isOnline = true;
    console.log('🌐 Network online - re-enabling Firestore');
    enableNetwork(firestore).catch(err => console.error('Failed to enable Firestore:', err));
    networkListeners.forEach(listener => listener(true));
});

window.addEventListener('offline', () => {
    isOnline = false;
    console.warn('⚠️ Network offline - disabling Firestore');
    disableNetwork(firestore).catch(err => console.error('Failed to disable Firestore:', err));
    networkListeners.forEach(listener => listener(false));
});

/**
 * Register network state listener
 */
export function onNetworkStateChange(callback) {
    networkListeners.push(callback);
    callback(isOnline);
    return () => {
        networkListeners = networkListeners.filter(l => l !== callback);
    };
}

/**
 * Anonymous Auth - 匿名認証を確実に実行（リトライ付き）
 */
async function ensureAnonymousAuth(retries = 3) {
    if (!auth.currentUser) {
        metrics.authAttempts++;
        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                const startTime = Date.now();
                await signInAnonymously(auth);
                const duration = Date.now() - startTime;
                
                metrics.authSuccess++;
                console.log(`✅ Anonymous Auth Success (${duration}ms)`);
                console.log(`📋 Current user: ${auth.currentUser?.uid || 'none'}`);
                console.log(`🔐 Auth metrics: attempts=${metrics.authAttempts}, success=${metrics.authSuccess}, failures=${metrics.authFailures}`);
                return true;
            } catch (error) {
                metrics.authFailures++;
                console.error(`❌ Anonymous Auth Failed (attempt ${attempt + 1}/${retries}):`, error);
                
                if (attempt < retries - 1) {
                    const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
                    console.log(`⏳ Retrying auth in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    throw new Error('認証に失敗しました。ネットワークを確認して再度お試しください。');
                }
            }
        }
    }
    return true;
}

// --- Auth State Monitoring ---
let authStateUnsubscribe = null;

/**
 * Setup auth state monitoring with auto-reauthentication
 */
function setupAuthStateMonitoring() {
    if (authStateUnsubscribe) return;
    
    authStateUnsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log(`✅ Auth state: authenticated (${user.uid})`);
        } else {
            console.warn('⚠️ Auth state: unauthenticated - attempting reauth...');
            try {
                await ensureAnonymousAuth();
            } catch (error) {
                console.error('❌ Auto-reauth failed:', error);
            }
        }
    }, (error) => {
        console.error('❌ Auth state change error:', error);
    });
}

/**
 * Get performance metrics
 */
export function getMetrics() {
    return {
        ...metrics,
        uptime: Date.now() - metrics.startTime,
        isOnline
    };
}
export async function initFirebase() {
    try {
        console.log('🚀 Initializing Firebase...');
        const startTime = Date.now();
        
        // 匿名認証を確実に実行
        await ensureAnonymousAuth();
        
        // 認証状態監視を設定
        setupAuthStateMonitoring();
        
        // ネットワーク状態を確認
        if (!isOnline) {
            console.warn('⚠️ Initializing in offline mode');
        }
        
        const duration = Date.now() - startTime;
        console.log(`✅ Firebase initialization complete (${duration}ms)`);
        console.log(`📊 Initial metrics:`, getMetrics());
        
        return Promise.resolve();
    } catch (error) {
        console.error('❌ Firebase initialization failed:', error);
        throw error;
    }
}

/**
 * Creates a new video processing job document in Firestore with retry logic.
 * @param {string} userId - The user's ID.
 * @param {string} fileName - The name of the video file.
 * @returns {Promise<string>} - The unique ID of the created job.
 */
async function createVideoJob(userId, fileName, retries = 3) {
    metrics.firestoreOps++;
    
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            // 認証状態を確認・再認証
            if (!auth.currentUser) {
                console.warn(`⚠️ Not authenticated (attempt ${attempt + 1}/${retries}) - reauthenticating...`);
                await ensureAnonymousAuth();
            }

            if (!auth.currentUser) {
                throw new Error('認証が必要です。ページを再読み込みしてお試しください。');
            }

            const firebaseUid = auth.currentUser.uid;
            const startTime = Date.now();
            
            console.log(`📝 Creating job (attempt ${attempt + 1}/${retries}) - Firebase UID: ${firebaseUid}, LIFF User ID: ${userId}`);
            
            // ネットワーク状態を確認
            if (!isOnline) {
                throw new Error('オフライン状態です。ネットワーク接続を確認してください。');
            }
            
            const jobsCollection = collection(firestore, 'video_jobs');
            const docRef = await Promise.race([
                addDoc(jobsCollection, {
                    userId: userId, // LIFF User ID
                    firebaseUid: firebaseUid, // Firebase UID
                    originalFileName: fileName,
                    status: 'pending', // pending -> processing -> completed / error
                    createdAt: serverTimestamp(),
                    retries: 0,
                }),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Firestore接続タイムアウト')), 30000)
                )
            ]);
            
            const duration = Date.now() - startTime;
            console.log(`✅ Job created in Firestore with ID: ${docRef.id} (${duration}ms)`);
            return docRef.id;
            
        } catch (error) {
            console.error(`❌ Failed to create Firestore job (attempt ${attempt + 1}/${retries}):`, error);
            console.error('Error details:', {
                code: error.code,
                message: error.message,
                name: error.name,
                isOnline,
                hasAuth: !!auth.currentUser
            });
            
            // リトライ可能なエラーの場合
            if (attempt < retries - 1) {
                const isRetryableError = 
                    error.code === 'unavailable' ||
                    error.code === 'deadline-exceeded' ||
                    error.message.includes('タイムアウト') ||
                    error.message.includes('ネットワーク');
                
                if (isRetryableError) {
                    const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
                    console.log(`⏳ Retrying Firestore operation in ${delay}ms...`);
                    
                    // ネットワークがオフラインの場合は待機
                    if (!isOnline) {
                        await new Promise((resolve) => {
                            const unsubscribe = onNetworkStateChange((online) => {
                                if (online) {
                                    unsubscribe();
                                    resolve();
                                }
                            });
                            // 最大10秒待機
                            setTimeout(() => {
                                unsubscribe();
                                resolve();
                            }, 10000);
                        });
                    }
                    
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
            }
            
            // リトライ不能または最終試行失敗
            if (error.code === 'permission-denied') {
                throw new Error("解析ジョブの作成権限がありません。匿名認証を確認してください。");
            } else if (error.code === 'unavailable' || error.message.includes('タイムアウト')) {
                throw new Error("Firestoreサービスが利用できません。ネットワークを確認してください。");
            } else if (error.message.includes('認証')) {
                throw error; // 認証エラーはそのまま伝播
            } else {
                throw new Error(`解析ジョブの作成に失敗しました: ${error.message || '不明なエラー'}`);
            }
        }
    }
    
    throw new Error('解析ジョブの作成に失敗しました（リトライ上限に達しました）');
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

    // 0. 認証を確認（未認証の場合は認証を実行）
    if (!auth.currentUser) {
        console.log('⚠️ 認証されていないため、匿名認証を実行します...');
        try {
            await ensureAnonymousAuth();
        } catch (error) {
            console.error('❌ Anonymous auth failed during upload:', error);
            throw new Error('認証に失敗しました。ページを再読み込みしてお試しください。');
        }
    }

    // 認証状態を再度確認
    if (!auth.currentUser) {
        console.error('❌ Still not authenticated after ensureAnonymousAuth');
        throw new Error('認証に失敗しました。ページを再読み込みしてお試しください。');
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

    // 認証状態を詳細にログ出力（デバッグ用）
    console.log(`🚀 Starting upload for job ${jobId} to ${storagePath}`);
    console.log(`📋 Firebase UID: ${firebaseUid}`);
    console.log(`📋 LIFF User ID: ${userId}`);
    console.log(`📋 Auth provider: ${auth.currentUser?.providerData?.[0]?.providerId || 'anonymous'}`);
    console.log(`📋 Auth token: ${auth.currentUser ? 'present' : 'missing'}`);
    console.log(`📋 Auth UID matches path: ${auth.currentUser?.uid === firebaseUid ? 'YES' : 'NO'}`);
    
    // 認証トークンの有効性を確認
    try {
        const token = await auth.currentUser.getIdToken(true); // 強制リフレッシュ
        console.log(`✅ Auth token retrieved: ${token.substring(0, 20)}...`);
    } catch (tokenError) {
        console.error('❌ Failed to get auth token:', tokenError);
        // トークン取得失敗時は再認証を試みる
        await ensureAnonymousAuth();
        const newToken = await auth.currentUser.getIdToken(true);
        console.log(`✅ Re-authenticated and got new token: ${newToken.substring(0, 20)}...`);
    }

    // 3. Execute the upload with enhanced progress tracking.
    metrics.storageOps++;
    const uploadTask = uploadBytesResumable(storageRef, videoFile);
    
    const uploadStartTime = Date.now();
    let lastProgressTime = Date.now();
    let lastBytesTransferred = 0;

    return new Promise((resolve, reject) => {
        // タイムアウト設定（5分、ただし進行中は延長）
        let timeoutId = setTimeout(() => {
            uploadTask.cancel();
            reject(new Error('アップロードがタイムアウトしました。ネットワークを確認して再度お試しください。'));
        }, 5 * 60 * 1000);

        uploadTask.on(
            'state_changed',
            (snapshot) => {
                const now = Date.now();
                const progress = snapshot.totalBytes > 0
                    ? (snapshot.bytesTransferred / snapshot.totalBytes) * 100
                    : 0;
                
                // タイムアウトをリセット（進行中の場合）
                if (progress > 0) {
                    clearTimeout(timeoutId);
                    timeoutId = setTimeout(() => {
                        uploadTask.cancel();
                        reject(new Error('アップロードがタイムアウトしました。ネットワークを確認して再度お試しください。'));
                    }, 5 * 60 * 1000);
                }
                
                // 速度計算
                const timeDelta = (now - lastProgressTime) / 1000; // 秒
                const bytesDelta = snapshot.bytesTransferred - lastBytesTransferred;
                const speed = timeDelta > 0 ? bytesDelta / timeDelta : 0; // bytes/sec
                const remainingBytes = snapshot.totalBytes - snapshot.bytesTransferred;
                const estimatedTimeRemaining = speed > 0 ? remainingBytes / speed : 0;
                
                // 詳細な進捗情報をログ出力（10%刻み）
                if (Math.floor(progress) % 10 === 0 && progress > 0) {
                    console.log(`📊 Upload progress: ${Math.round(progress)}% | Speed: ${(speed / 1024 / 1024).toFixed(2)}MB/s | ETA: ${Math.round(estimatedTimeRemaining)}s`);
                }
                
                lastProgressTime = now;
                lastBytesTransferred = snapshot.bytesTransferred;
                
                // 拡張された進捗コールバック（詳細情報を含む）
                if (progressCallback) {
                    progressCallback(progress, {
                        bytesTransferred: snapshot.bytesTransferred,
                        totalBytes: snapshot.totalBytes,
                        speed: speed,
                        estimatedTimeRemaining: estimatedTimeRemaining,
                        elapsedTime: (now - uploadStartTime) / 1000
                    });
                }
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
                const duration = Date.now() - uploadStartTime;
                const fileSizeMB = (videoFile.size / 1024 / 1024).toFixed(2);
                const avgSpeed = (videoFile.size / (duration / 1000) / 1024 / 1024).toFixed(2);
                
                console.log(`✅ Upload complete for job ${jobId}`);
                console.log(`📊 Upload metrics: ${fileSizeMB}MB in ${(duration / 1000).toFixed(1)}s (avg ${avgSpeed}MB/s)`);
                console.log(`📊 Total metrics:`, getMetrics());
                
                // Here you could update the Firestore job status to 'uploaded'
                resolve();
            }
        );
    });
}


