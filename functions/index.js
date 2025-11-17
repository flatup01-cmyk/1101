// functions/index.js 【最終確定版 v400 - 返信順序修正】

import {onRequest} from "firebase-functions/v2/https";
import {setGlobalOptions} from "firebase-functions/v2";
import fetch from 'node-fetch';
import { admin } from './initAdmin.js'; // 正しいインポート方式
import { handleVideoJob } from './dify/handler.js';
import { chatWithDify } from './dify/dify.js';
import { Client } from '@line/bot-sdk'; // 正しいインポート方式
import crypto from 'crypto';

// Functionsの全体設定
setGlobalOptions({region: "asia-northeast1"});

// 定数定義
const LINE_VERIFY_REPLY_TOKEN = '00000000000000000000000000000000';
const DIFY_BASE_URL = (process.env.DIFY_BASE_URL || 'https://api.dify.ai').replace(/\/$/, '');
const DIFY_APP_ID = process.env.DIFY_APP_ID || null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callDifyBlocking(payload, { maxAttempts = 3, timeoutMs = 15000 } = {}) {
  const apiKey = process.env.DIFY_API_KEY;
  if (!apiKey) {
    return { ok: false, error: 'Missing DIFY_API_KEY' };
  }

  const appQuery = DIFY_APP_ID ? `?app_id=${encodeURIComponent(DIFY_APP_ID)}` : '';
  const url = `${DIFY_BASE_URL}/v1/chat-messages${appQuery}`;
  let backoff = 1000;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timer);
      const textBody = await res.text();

      if (res.ok) {
        try {
          const json = JSON.parse(textBody);
          return { ok: true, data: json };
        } catch {
          return { ok: true, data: { answer: textBody } };
        }
      }

      const retriable =
        res.status === 429 ||
        res.status === 503 ||
        /503\s+UNAVAILABLE/i.test(textBody) ||
        /model is overloaded/i.test(textBody);

      if (!retriable || attempt === maxAttempts) {
        return { ok: false, error: `Dify error ${res.status}: ${textBody}` };
      }

      await sleep(backoff);
      backoff = Math.min(backoff * 2, 8000);
    } catch (error) {
      if (attempt === maxAttempts) {
        return { ok: false, error: `Dify request failed: ${error.message}` };
      }
      await sleep(backoff);
      backoff = Math.min(backoff * 2, 8000);
    }
  }

  return { ok: false, error: 'dify_failed' };
}

async function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', (err) => reject(err));
  });
}

async function fetchLineImage(lineClient, messageId) {
  const contentStream = await lineClient.getMessageContent(messageId);
  const buffer = await streamToBuffer(contentStream);
  if (!buffer || buffer.length === 0) {
    throw new Error('Empty image buffer');
  }
  return buffer;
}

async function analyzeImage(buffer) {
  const sizeKb = Math.round(buffer.length / 1024);
  const hash = crypto.createHash('md5').update(buffer).digest('hex').slice(0, 12);

  return {
    status: 'success',
    metrics: {
      file_size_kb: sizeKb,
      content_hash: hash,
    },
  };
}

function buildImageAnalysisMessage(analysis) {
  const metrics = analysis?.metrics || {};
  const lines = [
    '画像解析の簡易結果です。',
    `・ファイルサイズ: 約 ${metrics.file_size_kb ?? '-' } KB`,
    `・コンテンツハッシュ（短縮）: ${metrics.content_hash ?? '-' }`,
  ];
  return lines.join('\n');
}

function buildImageFallback(reason) {
  const suffix = reason ? `（理由: ${reason}）` : '';
  return `画像解析が混雑しています。時間をおいて再度お試しください。${suffix}`;
}

function buildDifyPayloadForImage(userId, analysis) {
  const metrics = analysis?.metrics || {};
  return {
    query:
      '以下の画像メタ情報をもとにAIKA18号として簡潔で丁寧なコメントを作成してください。' +
      '過度に失礼な表現は禁止とし、ユーザーが理解しやすい言葉遣いでまとめてください。',
    inputs: {
      file_size_kb: String(metrics.file_size_kb ?? ''),
      content_hash: String(metrics.content_hash ?? ''),
    },
    user: userId,
    response_mode: 'blocking',
  };
}

async function replyOrPushMessage(lineClient, replyToken, userId, messages) {
  const payload = Array.isArray(messages) ? messages : [{ type: 'text', text: messages }];
  if (replyToken) {
    try {
      await lineClient.replyMessage(replyToken, payload);
      return;
    } catch (error) {
      const status = error?.statusCode || error?.status;
      if (status && Number(status) !== 400) {
        console.warn('replyMessage failed, fallback to push:', error);
      }
    }
  }
  if (userId) {
    await lineClient.pushMessage(userId, payload);
  } else {
    console.warn('pushMessage skipped: userId is missing');
  }
}


// ================================================================
// ★ LINE Webhook Router Function (門番) ★
// ================================================================
export const lineWebhookRouter = onRequest(
  {
    secrets: ["MAKE_WEBHOOK_URL", "LINE_CHANNEL_ACCESS_TOKEN", "DIFY_API_KEY"],
    serviceAccount: '639286700347-compute@developer.gserviceaccount.com',
    timeoutSeconds: 300,
  },
  async (req, res) => {
    if (!process.env.DIFY_API_KEY) {
      console.error("重大なエラー: 環境変数 DIFY_API_KEY が設定されていません。");
      res.status(500).send("サーバー設定エラーです。");
      return;
    }
    if (!process.env.PROCESS_VIDEO_JOB_URL) {
      console.error("重大なエラー: 環境変数 PROCESS_VIDEO_JOB_URL が設定されていません。");
      res.status(500).send("サーバー設定エラーです。");
      return;
    }
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

      if (event.type === 'message' && event.message.type === 'image') {
        const userId = event.source?.userId ?? null;
        const replyToken = event.replyToken;
        const messageId = event.message.id;
        console.info(`画像メッセージを検知。処理を開始します。(画像ID: ${messageId}, userId: ${userId ?? 'unknown'})`);

        if (!res.headersSent) {
          res.status(200).send('OK');
        }

        (async () => {
          try {
            const buffer = await fetchLineImage(lineClient, messageId);
            console.info(`画像を取得しました（${buffer.length} bytes）`);

            const analysis = await analyzeImage(buffer);
            let messageText = buildImageAnalysisMessage(analysis);

            const difyPayload = buildDifyPayloadForImage(userId, analysis);
            const difyResult = await callDifyBlocking(difyPayload, { maxAttempts: 3, timeoutMs: 15000 });

            if (difyResult.ok) {
              const answer = typeof difyResult.data?.answer === 'string' ? difyResult.data.answer.trim() : '';
              if (answer) {
                messageText = answer;
              } else {
                messageText += '\n（AIコメント生成は混雑のため簡易結果のご提供です）';
              }
            } else {
              console.warn('Dify image response fallback:', difyResult.error);
              messageText += '\n（AIコメント生成は混雑のため簡易結果のご提供です）';
            }

            await replyOrPushMessage(lineClient, replyToken, userId, messageText);
            console.info('画像解析の返信を送信しました。');
          } catch (error) {
            console.error('画像メッセージ処理でエラーが発生しました:', error);
            try {
              await replyOrPushMessage(lineClient, replyToken, userId, buildImageFallback(error.message));
            } catch (pushError) {
              console.error('画像フォールバックの送信にも失敗しました:', pushError);
            }
          }
        })();

        return;
      }

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
    timeoutSeconds: 540, // 9分（動画解析に時間がかかるため）
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
        console.error("❌ processVideoJob: videoUrlが設定されていません");
        res.status(400).json({ ok: false, error: "videoUrl is required" });
        return;
      }
      if (!lineUserId) {
        console.error("❌ processVideoJob: lineUserIdが設定されていません");
        res.status(400).json({ ok: false, error: "lineUserId is required" });
        return;
      }
      
      console.info(`🚀 processVideoJob開始: jobId=${jobId}, lineUserId=${lineUserId}, videoUrl=${videoUrl.substring(0, 100)}...`);
      
      // handleVideoJobを呼び出し（エラーが発生しても、必ず何らかの結果を返す）
      const result = await handleVideoJob({
        jobId: jobId || lineUserId,
        userId: lineUserId,
        lineUserId: lineUserId,
        videoUrl: videoUrl,
        useStreaming: false,
        conversationId: null,
        extraJobData: {},
      });
      
      console.info("✅ processVideoJob成功:", JSON.stringify({
        answerLength: result.answer?.length || 0,
        conversationId: result.conversation_id || null,
        hasMeta: !!result.meta,
      }));
      
      // 成功時もエラー時も、必ず200を返す（handleVideoJob内でユーザーにメッセージを送信済み）
      res.status(200).json({ ok: true, result });
    } catch (error) {
      // このエラーは、handleVideoJob内で既に処理されているはず
      // しかし、予期しないエラーが発生した場合は、ここで処理する
      console.error("❌ processVideoJobで予期しないエラー:", {
        error: error.message,
        stack: error.stack,
        name: error.name,
      });
      
      // エラーが発生しても、必ず200を返す（ユーザーへの通知はhandleVideoJob内で行われている）
      res.status(200).json({ 
        ok: false, 
        error: error.message,
        message: "エラーが発生しましたが、ユーザーには通知済みです。"
      });
    }
  }
);

