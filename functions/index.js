// functions/index.js 【最終確定版 v400 - 返信順序修正】

import {onRequest} from "firebase-functions/v2/https";
import {setGlobalOptions} from "firebase-functions/v2";
import fetch from 'node-fetch';
import crypto from 'crypto';
import { admin } from './initAdmin.js'; // 正しいインポート方式
import { handleVideoJob, handleImageJob } from './dify/handler.js';
import { handleTextChat } from './dify/chat.js';
import { Client } from '@line/bot-sdk'; // 正しいインポート方式

// Functionsの全体設定
setGlobalOptions({region: "asia-northeast1"});

// 定数定義
const LINE_VERIFY_REPLY_TOKEN = '00000000000000000000000000000000';
const firestore = admin.firestore();
const serverTimestamp = admin.firestore.FieldValue.serverTimestamp;

const STORAGE_LIMIT_BYTES = Math.floor(4.9 * 1024 * 1024 * 1024); // 約4.9GB
const STORAGE_USAGE_DOC = firestore.doc('system_settings/storageUsage');
const STORAGE_USAGE_CACHE_MS = 5 * 60 * 1000;
const PROCESSING_GUARD_DOC = firestore.doc('system_settings/processingGuard');
const USER_USAGE_COL = firestore.collection('user_usage');
const QUOTA_LIMITS = {
  video: 1,
  image: 3,
  text: 5,
};

const STOP_RESPONSE = '現在混雑のため受付を停止しています。時間をおいてからもう一度試しなさい。\n\n---\n[English]\nRequests are temporarily paused due to heavy load. Please try again later.';
const STORAGE_FULL_RESPONSE = '現在ストレージが満杯です。数日後に再度お試しください。\n\n---\n[English]\nStorage is full. Please try again in a few days.';
const QUOTA_RESPONSE = '本日の無料枠は終了しました。明日また試してください。\n\n---\n[English]\nYour free quota for today has been reached. Please try again tomorrow.';

async function sendLineText(lineClient, replyToken, userId, message) {
  if (replyToken && replyToken !== LINE_VERIFY_REPLY_TOKEN) {
    try {
      await lineClient.replyMessage(replyToken, { type: 'text', text: message });
      return true;
    } catch (error) {
      console.warn('Reply失敗のためPushにフォールバック:', error?.message);
    }
  }
  if (!userId) return false;
  try {
    await lineClient.pushMessage(userId, { type: 'text', text: message });
    return true;
  } catch (pushError) {
    console.error('Pushメッセージ送信失敗:', pushError);
    return false;
  }
}

async function isProcessingDisabled() {
  try {
    const snap = await PROCESSING_GUARD_DOC.get();
    const data = snap.exists ? snap.data() : null;
    return Boolean(data?.isDisabled);
  } catch (error) {
    console.error('停止フラグ取得エラー:', error);
    return false;
  }
}

async function getCachedStorageUsage() {
  try {
    const snap = await STORAGE_USAGE_DOC.get();
    if (!snap.exists) return null;
    const data = snap.data();
    const checkedAt = data.checkedAt?.toMillis();
    if (!checkedAt) return null;
    const age = Date.now() - checkedAt;
    if (age > STORAGE_USAGE_CACHE_MS) return null;
    return data.totalBytes ?? null;
  } catch (error) {
    console.error('ストレージ使用量キャッシュ取得エラー:', error);
    return null;
  }
}

async function calculateStorageUsageBytes(bucket) {
  let totalBytes = 0;
  try {
    const [files] = await bucket.getFiles();
    for (const file of files) {
      const size = Number(file.metadata?.size || 0);
      if (!Number.isNaN(size)) {
        totalBytes += size;
      }
    }
  } catch (error) {
    console.error('ストレージ使用量計算エラー:', error);
    throw error;
  }
  return totalBytes;
}

async function ensureStorageCapacity(bucket) {
  let totalBytes = await getCachedStorageUsage();
  if (totalBytes === null) {
    totalBytes = await calculateStorageUsageBytes(bucket);
    try {
      await STORAGE_USAGE_DOC.set(
        {
          totalBytes,
          checkedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    } catch (cacheError) {
      console.error('ストレージ使用量キャッシュ更新エラー:', cacheError);
    }
  }
  return totalBytes < STORAGE_LIMIT_BYTES;
}

function usageDocId(userId, dateKey) {
  return `${userId}_${dateKey}`;
}

function getTodayKey() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = `${now.getUTCMonth() + 1}`.padStart(2, '0');
  const d = `${now.getUTCDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function checkAndIncrementQuota(userId, requestType) {
  const limit = QUOTA_LIMITS[requestType];
  if (!limit) return true;
  const todayKey = getTodayKey();
  const docRef = USER_USAGE_COL.doc(usageDocId(userId, todayKey));

  try {
    return await firestore.runTransaction(async (transaction) => {
      const snap = await transaction.get(docRef);
      const data = snap.exists ? snap.data() : {};
      const currentCount = Number(data[requestType] || 0);
      if (currentCount >= limit) {
        return false;
      }
      const updateData = {
        dateKey: todayKey,
        [requestType]: currentCount + 1,
        updatedAt: serverTimestamp(),
      };
      if (!snap.exists) {
        updateData.createdAt = serverTimestamp();
        for (const key of Object.keys(QUOTA_LIMITS)) {
          if (key !== requestType && !(key in updateData)) {
            updateData[key] = 0;
          }
        }
      }
      transaction.set(docRef, updateData, { merge: true });
      return true;
    });
  } catch (error) {
    console.error('クォータ更新エラー:', error);
    // エラー時は安全側（許可）で進める
    return true;
  }
}

async function runProcessingGuards({ lineClient, replyToken, userId, requestType }) {
  // Firestore停止フラグ
  if (await isProcessingDisabled()) {
    await sendLineText(lineClient, replyToken, userId, STOP_RESPONSE);
    return { allowed: false, status: 503 };
  }

  const bucket = admin.storage().bucket();
  const hasCapacity = await ensureStorageCapacity(bucket);
  if (!hasCapacity) {
    await sendLineText(lineClient, replyToken, userId, STORAGE_FULL_RESPONSE);
    return { allowed: false, status: 503 };
  }

  const quotaOk = await checkAndIncrementQuota(userId, requestType);
  if (!quotaOk) {
    await sendLineText(lineClient, replyToken, userId, QUOTA_RESPONSE);
    return { allowed: false, status: 429 };
  }

  return { allowed: true };
}

/**
 * LINE Webhook署名検証関数
 * @param {string} body - リクエストボディ（JSON文字列）
 * @param {string} signature - X-Line-Signatureヘッダーの値
 * @param {string} channelSecret - LINEチャネルシークレット
 * @returns {boolean} 検証成功時true
 */
function verifyLineSignature(body, signature, channelSecret) {
  if (!signature || !channelSecret) {
    console.warn("署名またはチャネルシークレットが設定されていません");
    return false;
  }
  const hash = crypto
    .createHmac('sha256', channelSecret)
    .update(body)
    .digest('base64');
  return hash === signature;
}

// ================================================================
// ★ LINE Webhook Router Function (門番) ★
// ================================================================
export const lineWebhookRouter = onRequest(
  {
    secrets: ["MAKE_WEBHOOK_URL", "LINE_CHANNEL_ACCESS_TOKEN", "PROCESS_VIDEO_JOB_URL", "PROCESS_IMAGE_JOB_URL", "DIFY_API_KEY", "LINE_CHANNEL_SECRET"],
    serviceAccount: '639286700347-compute@developer.gserviceaccount.com',
    timeoutSeconds: 300,
  },
  async (req, res) => {
    try {
      // LINE Webhook署名検証（セキュリティ強化）
      const signature = req.headers['x-line-signature'];
      const rawBody = JSON.stringify(req.body);
      const channelSecret = process.env.LINE_CHANNEL_SECRET;
      
      // 検証トークンの場合はスキップ
      if (req.body.events && req.body.events[0] && req.body.events[0].replyToken === LINE_VERIFY_REPLY_TOKEN) {
        console.info("検証トークンのため署名検証をスキップします。");
      } else if (channelSecret && !verifyLineSignature(rawBody, signature, channelSecret)) {
        console.error("LINE Webhook署名検証失敗");
        res.status(401).send('Unauthorized');
        return;
      }
      
      const events = req.body.events;
      if (!events || events.length === 0 || events[0].replyToken === LINE_VERIFY_REPLY_TOKEN) {
        console.info("処理対象外のイベントのため終了します。");
        res.status(200).send('OK'); // この場合もOKを返す
        return;
      }

      const event = events[0];
      const lineClient = new Client({
        channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN
      });

      if (event.type === 'message' && event.message.type === 'video') {
        // ソースタイプを判定
        const sourceType = event.source?.type || 'unknown';
        const sourceUserId = event.source?.userId || 'unknown';
        const isRichMenu = event.source?.type === 'richMenu' || false; // リッチメニュー由来かどうか（LINE APIの仕様により、通常はuserとして扱われる可能性がある）
        
        console.info(`動画メッセージを検知。処理を開始します。(動画ID: ${event.message.id}, ソースタイプ: ${sourceType}, ユーザーID: ${sourceUserId}, リッチメニュー由来: ${isRichMenu})`);

        const userId = event.source.userId;
        const messageId = event.message.id;
        
        // 先にLINEにOKを返す（replyTokenの有効期限を考慮）
        res.status(200).send('OK');
        
        try {
          // ★★★★★ リプライトークンエラー対策 ★★★★★
          // replyTokenが存在し、有効な場合のみreplyMessageを使用
          // それ以外はpushMessageを使用
          const replyMessage = {
            type: 'text',
            text: '動画を受け付けました！AIが解析を開始します。\n\n通常は2〜3分ほどで結果が届きますが、混雑時は最大5分ほどかかる場合があります。どうぞそのままお待ちください。\n体験レッスンのお申し込みはこちら → https://flatupnarita.jp/contact\n\n※解析対象は20秒以内/100MB以下の動画です。\n\n---\n[English]\nWe have received your video. Results usually arrive within 2–3 minutes (up to 5 minutes during peak times). Flatup trial booking → https://flatupnarita.jp/contact'
          };
          
          if (event.replyToken && event.replyToken !== LINE_VERIFY_REPLY_TOKEN) {
            try {
              // replyTokenが有効な場合、即座に返信
              await lineClient.replyMessage(event.replyToken, replyMessage);
              console.info("ユーザーへの受付完了メッセージの送信に成功しました（Reply API使用）。");
            } catch (replyError) {
              // replyTokenが無効または失効している場合、pushMessageにフォールバック
              console.warn("Reply API失敗、Push APIにフォールバック:", replyError.message);
              await lineClient.pushMessage(userId, replyMessage);
              console.info("ユーザーへの受付完了メッセージの送信に成功しました（Push API使用）。");
            }
          } else {
            // replyTokenが存在しない場合、pushMessageを使用
            await lineClient.pushMessage(userId, replyMessage);
            console.info("ユーザーへの受付完了メッセージの送信に成功しました（Push API使用）。");
          }
          
          // --- ここから先の重い処理は、レスポンスを返した後にゆっくり実行される ---
          const fileName = `${userId}/${messageId}.mp4`; // Difyのルールに合わせて、videos/接頭辞を削除
          const bucket = admin.storage().bucket();
          const file = bucket.file(fileName);

          const videoStream = await lineClient.getMessageContent(messageId);
          await new Promise((resolve, reject) => {
            const writeStream = file.createWriteStream();
            videoStream.pipe(writeStream);
            writeStream.on('finish', resolve);
            writeStream.on('error', reject);
          });
          
          console.info(`動画をCloud Storageに保存しました: ${fileName}`);
          
          // Difyが動画にアクセスできるように、署名付きURLを生成（有効期限: 15分）
          // 署名付きURLを生成するための設定（v4署名を使用）
          const options = {
            version: 'v4',
            action: 'read',
            expires: Date.now() + 15 * 60 * 1000, // 15分後
          };
          
          // 署名付きURLを生成
          const [signedUrl] = await file.getSignedUrl(options);
          const videoUrl = signedUrl;
          console.info(`署名付きURLを生成しました: ${videoUrl.substring(0, 100)}...`);
          
          const processVideoJobUrl = process.env.PROCESS_VIDEO_JOB_URL;
          
          // Difyの処理は時間がかかるので、呼び出しっぱなしでOK
          fetch(processVideoJobUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ jobId: messageId, lineUserId: userId, videoUrl: videoUrl })
          });
          console.info(`Dify処理関数 (processVideoJob) の呼び出しを開始しました。`);
        } catch (error) {
          console.error("動画処理エラーを検知しました（静的失敗の可能性）:", {
            userId,
            messageId,
            sourceType,
            errorMessage: error?.message,
            stack: error?.stack,
          });
          // エラー時も必ずメッセージを返す
          try {
            await lineClient.pushMessage(userId, {
              type: 'text',
              text: '申し訳ありません。動画の処理中にエラーが発生しました。\n\n動画の形式（HEVC/H.265 など特殊コーデック）やファイル破損が原因の可能性があります。時間をおいて再送いただくか、別形式で撮影した動画でお試しください。\n\n---\n[English]\nWe could not process this video. It may use an unsupported format or be corrupted. Please retry later or send another recording.'
            });
          } catch (pushError) {
            console.error("動画処理エラー通知の送信にも失敗しました:", {
              userId,
              messageId,
              pushErrorMessage: pushError?.message,
              stack: pushError?.stack,
            });
          }
          // LINEには既にOKを返しているので、ここでは何もしない
        }

      } else if (event.type === 'message' && event.message.type === 'image') {
        console.info('画像メッセージを検知。解析ジョブを開始します。');
        const userId = event.source.userId;
        const messageId = event.message.id;

        res.status(200).send('OK');

        const acknowledgeMessage = {
          type: 'text',
          text: '画像を受け付けました！AIが解析を開始します。\n\n通常は2〜3分ほどで結果が届きますが、混雑時は最大5分ほどかかる場合があります。Flatupの体験レッスンも準備しておくと良いわよ。\n体験レッスンのお申し込みはこちら → https://flatupnarita.jp/contact\n\n---\n[English]\nWe have received your image. Results usually arrive within 2–3 minutes (up to 5 minutes during peak times). Flatup trial booking → https://flatupnarita.jp/contact'
        };

        try {
          if (event.replyToken && event.replyToken !== LINE_VERIFY_REPLY_TOKEN) {
            try {
              await lineClient.replyMessage(event.replyToken, acknowledgeMessage);
              console.info('画像受付メッセージをReplyで送信しました。');
            } catch (replyError) {
              console.warn('画像受付 Reply 失敗。Pushにフォールバック:', replyError.message);
              await lineClient.pushMessage(userId, acknowledgeMessage);
            }
          } else {
            await lineClient.pushMessage(userId, acknowledgeMessage);
          }
        } catch (ackError) {
          console.error('画像受付メッセージ送信エラー:', ackError);
        }

        try {
          const bucket = admin.storage().bucket();
          const fileName = `images/${userId}/${messageId}.jpg`;
          const file = bucket.file(fileName);

          const imageStream = await lineClient.getMessageContent(messageId);
          await new Promise((resolve, reject) => {
            const writeStream = file.createWriteStream({ contentType: 'image/jpeg' });
            imageStream.pipe(writeStream);
            writeStream.on('finish', resolve);
            writeStream.on('error', reject);
          });

          console.info(`画像をCloud Storageに保存しました: ${fileName}`);

          const [signedUrl] = await file.getSignedUrl({
            version: 'v4',
            action: 'read',
            expires: Date.now() + 15 * 60 * 1000,
          });

          const processImageJobUrl = process.env.PROCESS_IMAGE_JOB_URL;
          if (!processImageJobUrl) {
            throw new Error('PROCESS_IMAGE_JOB_URL が設定されていません');
          }

          fetch(processImageJobUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jobId: messageId,
              lineUserId: userId,
              imageUrl: signedUrl,
            }),
          });
          console.info('画像解析ジョブを起動しました。');
        } catch (error) {
          console.error('画像処理エラー:', error);
          try {
            await lineClient.pushMessage(userId, {
              type: 'text',
              text: '画像の解析に失敗したわ。画像が不鮮明か大きすぎる可能性があるから、調整してもう一度送ってみなさい。\n\n---\n[English]\nImage analysis failed. Please try again with a clearer or smaller image.',
            });
          } catch (pushError) {
            console.error('画像エラー通知送信エラー:', pushError);
          }
        }

      } else if (event.type === 'message' && event.message.type === 'text') {
        // [テキストメッセージの処理] - Dify APIで直接会話
        console.info(`テキストメッセージを検知。Dify APIで会話を開始します。`);
        const userId = event.source.userId;
        const userMessage = event.message.text;
        
        // 先にLINEにOKを返す
        res.status(200).send('OK');
        
        try {
          // ★★★★★ 即時受付メッセージを送信 ★★★★★
          const acceptMessage = {
            type: 'text',
            text: 'メッセージを受け付けました。AIKA19号が返信を準備しています...\n\n---\n[English]\nMessage received. AIKA19 is preparing a reply...'
          };
          
          if (event.replyToken && event.replyToken !== LINE_VERIFY_REPLY_TOKEN) {
            try {
              await lineClient.replyMessage(event.replyToken, acceptMessage);
              console.info("テキストメッセージ受付完了メッセージの送信に成功しました（Reply API使用）。");
            } catch (replyError) {
              console.warn("Reply API失敗、Push APIにフォールバック:", replyError.message);
              await lineClient.pushMessage(userId, acceptMessage);
              console.info("テキストメッセージ受付完了メッセージの送信に成功しました（Push API使用）。");
            }
          } else {
            await lineClient.pushMessage(userId, acceptMessage);
            console.info("テキストメッセージ受付完了メッセージの送信に成功しました（Push API使用）。");
          }
          
          // handleTextChatを使用してDifyで会話処理
          const chatResult = await handleTextChat({
            userId,
            userMessage,
            conversationId: null, // Firestoreから取得される
            userGender: 'unknown', // Firestoreから取得される
          });

          const aikaReply = chatResult.answer;
          
          // LINEに返信（日本語と英語の両方で）
          // Difyが既に英語を含んでいる場合はそのまま使用、そうでない場合は簡易的な英語版を追加
          let replyText = aikaReply;
          if (!aikaReply.includes('[English]') && !aikaReply.includes('---\n[English]')) {
            replyText = `${aikaReply}\n\n---\n[English]\n${aikaReply}`;
          }
          
          await lineClient.pushMessage(userId, {
            type: 'text',
            text: replyText
          });
          
          console.info(`Dify API会話成功: ${aikaReply.substring(0, 50)}...`);
        } catch (error) {
          console.error("テキストメッセージ処理エラー:", error);
          try {
            await lineClient.pushMessage(userId, {
              type: 'text',
              text: '申し訳ございません。エラーが発生しました。しばらくしてから再度お試しください。\n\n---\n[English]\nSorry, an error occurred. Please try again later.'
            });
          } catch (pushError) {
            console.error("LINEメッセージ送信エラー:", pushError);
          }
        }
      } else {
        // [その他のイベントの処理] - Make.comへ転送
        console.info(`その他のイベントを検知。Make.comへ転送します。`);
        // この場合も、先にLINEにOKを返してから、転送処理を行う
        res.status(200).send('OK');

        const makeWebhookUrl = process.env.MAKE_WEBHOOK_URL;
        if (!makeWebhookUrl) {
          console.error("MAKE_WEBHOOK_URLが設定されていません。");
          return;
        }
        // 転送処理は呼び出しっぱなしでOK
        fetch(makeWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(req.body)
        });
        console.info(`Make.comへの転送を開始しました。`);
      }
    } catch (error) {
      console.error("lineWebhookRouterで予期せぬエラーが発生しました:", error);
      // エラーが起きても、LINEにはOKを返しておく（タイムアウトを防ぐため）
      if (!res.headersSent) {
        res.status(200).send('OK');
      }
    }
  }
);

// ================================================================
// ★ Video Job Processing Function (Dify処理本体) ★ (変更なし)
// ================================================================
export const processVideoJob = onRequest(
  {
    secrets: ["DIFY_API_KEY", "LINE_CHANNEL_ACCESS_TOKEN"],
    timeoutSeconds: 180,
  },
  async (req, res) => {
    // LINE Webhookのリクエストを無視（lineWebhookRouterで処理済み）
    if (req.body && req.body.events && Array.isArray(req.body.events)) {
      console.info("processVideoJob: LINE Webhookリクエストを検知。無視します。");
      res.status(200).json({ ok: true, message: "LINE WebhookはlineWebhookRouterで処理されます" });
      return;
    }
    
    try {
      const { jobId, lineUserId, videoUrl } = req.body;
      
      // 必須パラメータの検証
      if (!videoUrl) {
        throw new Error("videoUrl is required");
      }
      if (!lineUserId) {
        throw new Error("lineUserId is required");
      }
      
      console.info(`processVideoJob開始: jobId=${jobId}, lineUserId=${lineUserId}, videoUrl=${videoUrl}`);
      
      // handleVideoJobを呼び出し
      const result = await handleVideoJob({
        jobId: jobId || lineUserId,
        userId: lineUserId,
        lineUserId: lineUserId,
        videoUrl: videoUrl,
        useStreaming: false,
        conversationId: null,
        extraJobData: {},
      });
      
      console.info("processVideoJob成功:", JSON.stringify(result));
      res.status(200).json({ ok: true, result });
    } catch (error) {
      console.error("processVideoJobでエラー:", error);
      res.status(500).json({ ok: false, error: error.message });
    }
  }
);

export const processImageJob = onRequest(
  {
    secrets: ["DIFY_API_KEY", "LINE_CHANNEL_ACCESS_TOKEN"],
    timeoutSeconds: 180,
  },
  async (req, res) => {
    if (req.body && req.body.events && Array.isArray(req.body.events)) {
      console.info("processImageJob: LINE Webhookリクエストを検知。無視します。");
      res.status(200).json({ ok: true, message: "LINE WebhookはlineWebhookRouterで処理されます" });
      return;
    }

    try {
      const { jobId, lineUserId, imageUrl } = req.body;
      if (!imageUrl) {
        throw new Error('imageUrl is required');
      }
      if (!lineUserId) {
        throw new Error('lineUserId is required');
      }

      console.info(`processImageJob開始: jobId=${jobId}, lineUserId=${lineUserId}, imageUrl=${imageUrl}`);

      const result = await handleImageJob({
        jobId: jobId || lineUserId,
        userId: lineUserId,
        lineUserId,
        imageUrl,
        conversationId: null,
        extraJobData: {},
      });

      console.info("processImageJob成功:", JSON.stringify(result));
      res.status(200).json({ ok: true, result });
    } catch (error) {
      console.error("processImageJobでエラー:", error);
      res.status(500).json({ ok: false, error: error.message });
    }
  }
);

