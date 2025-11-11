// functions/index.js 【最終確定版 v400 - 返信順序修正】

import {onRequest} from "firebase-functions/v2/https";
import {setGlobalOptions} from "firebase-functions/v2";
import fetch from 'node-fetch';
import crypto from 'crypto';
import { admin } from './initAdmin.js'; // 正しいインポート方式
import { handleVideoJob } from './dify/handler.js';
import { Client } from '@line/bot-sdk'; // 正しいインポート方式

// Functionsの全体設定
setGlobalOptions({region: "asia-northeast1"});

// 定数定義
const LINE_VERIFY_REPLY_TOKEN = '00000000000000000000000000000000';

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
    secrets: ["MAKE_WEBHOOK_URL", "LINE_CHANNEL_ACCESS_TOKEN", "PROCESS_VIDEO_JOB_URL", "DIFY_API_KEY", "LINE_CHANNEL_SECRET"],
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
        console.info(`動画メッセージを検知。処理を開始します。(動画ID: ${event.message.id})`);

        const userId = event.source.userId;
        const messageId = event.message.id;
        
        try {
          // ★★★★★ ここが作戦変更の最重要ポイント ★★★★★
          // 1. まず、ユーザーに「受け付けました」と返信する (LINEへのOK応答より先に！)
          const replyMessage = {
            type: 'text',
            text: '動画を受け付けました！AIが解析を開始します。\n\n結果が届くまで、しばらくお待ちください…\n\n※解析は20秒以内/100MB以下の動画が対象です。'
          };
          // このawaitで、返信が終わるまで待つ
          await lineClient.replyMessage(event.replyToken, replyMessage);
          console.info("ユーザーへの受付完了メッセージの送信に成功しました。");
          
          // 2. ユーザーへの返信が終わってから、LINEに「OK」と応答する
          res.status(200).send('OK');
          // ★★★★★ 作戦変更ここまで ★★★★★
          
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
          console.error("動画処理エラー:", error);
          // エラー時も必ずメッセージを返す
          try {
            await lineClient.pushMessage(userId, {
              type: 'text',
              text: '…チッ、動画の処理中にエラーが発生したわ。もう一度送り直してみなさい。\n\n---\n[English]\nAn error occurred while processing your video. Please try again.'
            });
          } catch (pushError) {
            console.error("LINEメッセージ送信エラー:", pushError);
          }
          // LINEには既にOKを返しているので、ここでは何もしない
        }

      } else if (event.type === 'message' && event.message.type === 'text') {
        // [テキストメッセージの処理] - Dify APIで直接会話
        console.info(`テキストメッセージを検知。Dify APIで会話を開始します。`);
        const userId = event.source.userId;
        const userMessage = event.message.text;
        
        // 先にLINEにOKを返す
        res.status(200).send('OK');
        
        try {
          // Firestoreから会話IDを取得（会話の継続性を保つため）
          const userConversationsRef = admin.firestore().collection('user_conversations').doc(userId);
          const userConversationsDoc = await userConversationsRef.get();
          let conversationId = '';
          if (userConversationsDoc.exists) {
            conversationId = userConversationsDoc.data().conversationId || '';
          }
          
          // Dify APIで会話を生成
          const difyApiKey = process.env.DIFY_API_KEY;
          if (!difyApiKey) {
            console.error("DIFY_API_KEYが設定されていません。");
            await lineClient.pushMessage(userId, {
              type: 'text',
              text: '申し訳ございません。現在システムの設定が完了していません。しばらくしてから再度お試しください。'
            });
            return;
          }
          
          // Dify APIのチャットメッセージエンドポイントを呼び出し
          const difyResponse = await fetch('https://api.dify.ai/v1/chat-messages', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${difyApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              query: userMessage,
              user: userId,
              response_mode: 'blocking',
              conversation_id: conversationId, // 会話IDを使用（空の場合は新規会話）
            }),
          });
          
          if (!difyResponse.ok) {
            const errorText = await difyResponse.text();
            console.error(`Dify APIエラー: ${difyResponse.status} ${errorText}`);
            await lineClient.pushMessage(userId, {
              type: 'text',
              text: '申し訳ございません。AIの応答を取得できませんでした。しばらくしてから再度お試しください。'
            });
            return;
          }
          
          const difyResult = await difyResponse.json();
          const aikaReply = difyResult.answer || difyResult.text || '...別に、何か用？';
          const newConversationId = difyResult.conversation_id || conversationId;
          
          // Firestoreに会話IDを保存（会話の継続性を保つため）
          if (newConversationId) {
            await userConversationsRef.set({
              conversationId: newConversationId,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
          }
          
          // LINEに返信（日本語と英語の両方で）
          const replyText = `${aikaReply}\n\n---\n[English]\n${aikaReply}`;
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
              text: '申し訳ございません。エラーが発生しました。しばらくしてから再度お試しください。'
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

