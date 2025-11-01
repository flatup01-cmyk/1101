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

    // 1. Create a job document in Firestore first.
    const jobId = await createVideoJob(userId, videoFile.name);

    // 2. Define the storage path using the job ID for integrity.
    const storagePath = `videos/${userId}/${jobId}/${videoFile.name}`;
    const storageRef = ref(storage, storagePath);

    console.log(`🚀 Starting upload for job ${jobId} to ${storagePath}`);

    // 3. Execute the upload.
    const uploadTask = uploadBytesResumable(storageRef, videoFile);

    return new Promise((resolve, reject) => {
        uploadTask.on(
            'state_changed',
            (snapshot) => {
                const progress = snapshot.totalBytes > 0
                    ? (snapshot.bytesTransferred / snapshot.totalBytes) * 100
                    : 0;
                if (progressCallback) progressCallback(progress);
            },
            (error) => {
                console.error(`❌ Upload failed for job ${jobId}:`, error);
                // Here you could add logic to update the Firestore job status to 'error'
                reject(new Error("動画のアップロードに失敗しました。ネットワークを確認してやり直してください。"));
            },
            async () => {
                console.log(`✅ Upload complete for job ${jobId}`);
                // Here you could update the Firestore job status to 'uploaded'
                resolve();
            }
        );
    });
}

