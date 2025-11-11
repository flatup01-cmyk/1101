// functions/index.js 【最終確定版 v400 - 返信順序修正】

import {onRequest} from "firebase-functions/v2/https";
import {setGlobalOptions} from "firebase-functions/v2";
import fetch from 'node-fetch';
import { admin } from './initAdmin.js'; // 正しいインポート方式
import { handleVideoJob } from './dify/handler.js';
import { chatWithDify } from './dify/chat.js';
import { Client } from '@line/bot-sdk'; // 正しいインポート方式

// Functionsの全体設定
setGlobalOptions({region: "asia-northeast1"});

// 定数定義
const LINE_VERIFY_REPLY_TOKEN = '00000000000000000000000000000000';

// ================================================================
// ★ LINE Webhook Router Function (門番) ★
// ================================================================
export const lineWebhookRouter = onRequest(
  {
    secrets: ["MAKE_WEBHOOK_URL", "LINE_CHANNEL_ACCESS_TOKEN", "PROCESS_VIDEO_JOB_URL", "DIFY_API_KEY"],
    serviceAccount: '639286700347-compute@developer.gserviceaccount.com',
    timeoutSeconds: 300,
  },
  async (req, res) => {
    try {
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
        // ソースタイプを取得（リッチメニュー由来などを判定）
        const sourceType = event.source?.type || 'unknown';
        const userId = event.source?.userId || 'unknown';
        const messageId = event.message.id;
        // リッチメニュー経由かどうかは、イベントの詳細情報から判定
        // 通常のメッセージイベントとして来るため、詳細情報をログに出力
        console.info(`動画メッセージを検知。処理を開始します。(動画ID: ${messageId}, ソースタイプ: ${sourceType}, ユーザーID: ${userId})`);

        // 即時返信を送信（LINEへのOK応答より先に）
        const replyMessage = {
          type: 'text',
          text: '動画を受け付けました！AIが解析を開始します。\n\n結果が届くまで、しばらくお待ちください…\n\n※解析は20秒以内/100MB以下の動画が対象です。'
        };
        await lineClient.replyMessage(event.replyToken, replyMessage);
        console.info("受付完了メッセージ送信成功");
        
        // LINEにOKを返す
        res.status(200).send('OK');
        
        // 非同期処理: 動画のダウンロードとStorageへの保存
        try {
          const fileName = `${userId}/${messageId}.mp4`;
          const bucket = admin.storage().bucket();
          const file = bucket.file(fileName);

          console.info(`動画コンテンツの取得を開始: ${messageId}`);
          const videoStream = await lineClient.getMessageContent(messageId);
          
          await new Promise((resolve, reject) => {
            const writeStream = file.createWriteStream();
            videoStream.pipe(writeStream);
            writeStream.on('finish', resolve);
            writeStream.on('error', (err) => {
              console.error("Storage書き込みエラー:", err);
              reject(err);
            });
            videoStream.on('error', (err) => {
              console.error("LINEダウンロードエラー:", err);
              reject(err);
            });
          });
          
          console.info(`動画をStorageに保存: ${fileName}`);
          
          // 署名付きURLを生成（有効期限: 15分）
          const options = {
            version: 'v4',
            action: 'read',
            expires: Date.now() + 15 * 60 * 1000,
          };
          const [signedUrl] = await file.getSignedUrl(options);
          const videoUrl = signedUrl;
          console.info(`署名付きURL生成完了: ${videoUrl.substring(0, 50)}...`);
          
          // Dify処理関数を呼び出し
          const processVideoJobUrl = process.env.PROCESS_VIDEO_JOB_URL;
          fetch(processVideoJobUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jobId: messageId, lineUserId: userId, videoUrl: videoUrl })
          });
          console.info(`Dify処理関数の呼び出し開始: ${messageId}`);

        } catch (error) {
          // エラー詳細をログに記録
          console.error("動画処理エラー:", {
            message: error.message,
            stack: error.stack,
            messageId,
            userId,
            name: error.name,
            code: error.code,
          });

          // ユーザーにエラーメッセージを送信
          try {
            await lineClient.pushMessage(userId, {
              type: 'text',
              text: `申し訳ありません、お送りいただいた動画の処理中にエラーが発生しました。\n\n動画の形式が特殊であるか、ファイルが破損している可能性があります。\n\n別の動画でお試しいただくか、時間をおいて再度お試しください。`
            });
            console.info(`エラーメッセージを送信: ${userId}`);
          } catch (pushError) {
            console.error("エラーメッセージ送信失敗:", pushError);
          }
        }

      } else if (event.type === 'message' && event.message.type === 'text') {
        // テキストメッセージをDifyで処理
        console.info(`テキストメッセージを検知。Difyで処理します。(ユーザーID: ${event.source.userId})`);
        
        const userId = event.source.userId;
        const text = event.message.text;
        
        // 即時受付返信を送信
        const replyMessage = {
          type: 'text',
          text: 'メッセージを受け付けました！AIKAが返信を準備しています…'
        };
        await lineClient.replyMessage(event.replyToken, replyMessage);
        console.info("テキスト受付メッセージ送信成功");
        
        // LINEにOKを返す（タイムアウトを防ぐため）
        res.status(200).send('OK');
        
        // Difyで会話を処理（非同期）
        try {
          // Firestoreから会話IDを取得（存在する場合）
          const firestore = admin.firestore();
          const userDoc = await firestore.collection('users').doc(userId).get();
          const conversationId = userDoc.exists ? userDoc.data().conversation_id : null;
          
          // Difyで会話を処理
          const chatResult = await chatWithDify({
            query: text,
            userId: userId,
            conversationId: conversationId,
          });
          
          // 会話IDを保存
          if (chatResult.conversation_id) {
            await firestore.collection('users').doc(userId).set({
              conversation_id: chatResult.conversation_id,
              updated_at: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
          }
          
          // LINEに返信を送信
          await lineClient.pushMessage(userId, {
            type: 'text',
            text: chatResult.answer,
          });
          
          console.info(`Dify会話処理成功: ${chatResult.answer.substring(0, 50)}...`);
        } catch (error) {
          console.error('Dify会話処理エラー:', error);
          // エラー時はフォールバックメッセージを送信
          try {
            await lineClient.pushMessage(userId, {
              type: 'text',
              text: 'すみません、もう一度お願いします。',
            });
          } catch (pushError) {
            console.error('LINE pushエラー:', pushError);
          }
        }

      } else {
        // [動画・テキスト以外のイベントの処理]
        console.info(`動画・テキスト以外のイベントを検知。Make.comへ転送します。`);
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

