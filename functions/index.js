// functions/index.js 【最終確定版 v400 - 返信順序修正】

import {onRequest} from "firebase-functions/v2/https";
import {setGlobalOptions} from "firebase-functions/v2";
import fetch from 'node-fetch';
import { admin } from './initAdmin.js'; // 正しいインポート方式
import { handleVideoJob } from './dify/handler.js';
import { chatWithDify } from './dify/dify.js';
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
        // ソースタイプを判定（リッチメニュー経由か通常メッセージか）
        const sourceType = event.source?.type === 'user' ? '通常メッセージ' : 
                           event.source?.type === 'group' ? 'グループ' :
                           event.source?.type === 'room' ? 'トークルーム' : '不明';
        const sourceInfo = event.source?.userId ? `userId: ${event.source.userId}` : 'userId不明';
        console.info(`動画メッセージを検知。処理を開始します。(動画ID: ${event.message.id}, ソース: ${sourceType}, ${sourceInfo})`);

        // 動画処理のエラーハンドリング: 全ての処理をtry/catchで包み、エラーを確実に捕捉
        try {
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
          
          // --- ここから先の重い処理は、レスポンスを返した後にゆっくり実行される ---
          const messageId = event.message.id;
          const userId = event.source.userId;
          const fileName = `videos/${userId}/${messageId}.mp4`; // Storageトリガーで処理されるようにvideos/プレフィックスを追加
          const bucket = admin.storage().bucket();
          const file = bucket.file(fileName);

          console.info(`動画コンテンツの取得を開始します (ID: ${messageId})`);
          const videoStream = await lineClient.getMessageContent(messageId);
          
          await new Promise((resolve, reject) => {
            const writeStream = file.createWriteStream();
            videoStream.pipe(writeStream);
            writeStream.on('finish', resolve);
            // ストリームの途中でエラーが起きたら、それを捕捉してrejectする
            writeStream.on('error', (err) => {
              console.error("動画のCloud Storageへの書き込み中にストリームエラーが発生しました:", err);
              reject(err);
            });
            videoStream.on('error', (err) => {
              console.error("LINEからの動画ダウンロード中にストリームエラーが発生しました:", err);
              reject(err);
            });
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
          
          if (!processVideoJobUrl) {
            throw new Error('PROCESS_VIDEO_JOB_URL環境変数が設定されていません');
          }
          
          // Difyの処理は時間がかかるので、呼び出しっぱなしでOK
          // ただし、エラーが発生した場合はログに記録
          fetch(processVideoJobUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ jobId: messageId, lineUserId: userId, videoUrl: videoUrl })
          }).catch((fetchError) => {
            console.error(`Dify処理関数の呼び出しでエラーが発生しました: ${fetchError.message}`);
            // fetchエラーは非同期なので、ここではログのみ記録
            // ユーザーへの通知はprocessVideoJob側で行う
          });
          console.info(`Dify処理関数 (processVideoJob) の呼び出しを開始しました。`);

        } catch (error) {
          // エラーハンドリング: 動画処理中のエラーを捕捉し、ユーザーに通知
          console.error("動画処理の途中で致命的なエラーを検知しました:", error);
          console.error("エラーの詳細:", {
            message: error.message,
            stack: error.stack,
            name: error.name,
            videoId: event.message?.id,
            userId: event.source?.userId,
          });

          // ユーザーに、正直に「失敗したこと」とその理由を伝える
          const errorMessage = {
            type: 'text',
            text: `申し訳ありません、お送りいただいた動画の処理中にエラーが発生しました。\n\n動画の形式（フォーマット）が特殊であるか、ファイルが破損している可能性があります。\n\n恐れ入りますが、別の動画でお試しいただくか、時間をおいて再度お試しください。`
          };
          
          // 失敗しても、ユーザーには必ず応答を返す (Push APIを使用)
          // replyTokenは既に使用済みの可能性があるため、pushMessageを使用
          try {
            await lineClient.pushMessage(event.source.userId, errorMessage);
            console.info("ユーザーへ、動画処理失敗のエラーメッセージを送信しました。");
          } catch (pushError) {
            console.error(`エラーメッセージの送信にも失敗しました: ${pushError.message}`);
            // エラーメッセージの送信に失敗した場合でも、ログには記録済み
          }
        }

      } else if (event.type === 'message' && event.message.type === 'text') {
        // [テキストメッセージの処理 - Dify APIで会話処理]
        console.info(`テキストメッセージを検知。Dify APIで会話処理を開始します。`);
        const userId = event.source.userId;
        const userMessage = event.message.text;
        
        // 先にLINEにOKを返す
        res.status(200).send('OK');
        
        // 非同期処理はレスポンス返却後に実行
        (async () => {
          try {
            // Firestoreから会話IDを取得
            const db = admin.firestore();
            const userDocRef = db.collection('users').doc(userId);
            const userDoc = await userDocRef.get();
            let conversationId = null;
            
            if (userDoc.exists) {
              conversationId = userDoc.data()?.conversationId || null;
            }
            
            // Dify APIで会話処理
            const chatResult = await chatWithDify({
              message: userMessage,
              userId: userId,
              conversationId: conversationId,
            });
            
            // 会話IDをFirestoreに保存
            await userDocRef.set({
              conversationId: chatResult.conversation_id,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
            
            // LINEに返信を送信
            await lineClient.pushMessage(userId, {
              type: 'text',
              text: chatResult.answer,
            });
            
            console.info(`Dify会話処理成功: conversationId=${chatResult.conversation_id}`);
          } catch (error) {
            console.error(`Dify会話処理エラー: ${error.message}`);
            // エラー時はフォールバックメッセージを送信
            try {
              await lineClient.pushMessage(userId, {
                type: 'text',
                text: 'すみません、一時的なエラーが発生しました。しばらく待ってから再度お試しください。',
              });
            } catch (pushError) {
              console.error(`LINE送信エラー: ${pushError.message}`);
            }
          }
        })();
      } else {
        // [その他のイベントの処理]
        console.info(`その他のイベントを検知。スキップします。`);
        res.status(200).send('OK');
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

