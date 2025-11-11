# Dify API 500エラーとLINE Webhook混入の問題 - 修正完了報告

## 🔍 問題の状況

ログから以下の2つの問題を確認：

1. **`processVideoJob`がLINE Webhookのリクエストを直接受け取っている**
   - `req.body: {"destination":"...","events":[...]}`という形式のリクエストが届いている
   - これは`lineWebhookRouter`で処理すべきリクエスト

2. **Dify APIが500エラーを返している**
   - `Dify blocking error 500 Internal Server Error`
   - Dify側の一時的なエラーの可能性

## ✅ 実施した修正

### 1. processVideoJob側の修正 ✅

**変更内容:**
- LINE Webhookのリクエストを検知して無視する処理を追加
- デバッグログを追加（`processVideoJob開始`、`processVideoJob成功`）

**修正後のコード:**

```javascript
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
    
    console.info("processVideoJob受信 - リクエストメソッド:", req.method);
    console.info("processVideoJob受信 - Content-Type:", req.headers["content-type"]);
    console.info("processVideoJob受信 - req.body型:", typeof req.body);
    console.info("processVideoJob受信 - req.body:", JSON.stringify(req.body));
    
    try {
      const { jobId, lineUserId, videoUrl } = req.body;
      if (!videoUrl) throw new Error("videoUrl is required");
      if (!lineUserId) throw new Error("lineUserId is required");
      
      console.info(`processVideoJob開始: jobId=${jobId}, lineUserId=${lineUserId}, videoUrl=${videoUrl}`);
      
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
```

### 2. Dify APIのエラーハンドリング改善 ✅

**変更内容:**
- Dify APIが500エラーを返した場合、エラーをスローせずフォールバックメッセージを返す
- エラーメッセージの詳細化

**修正後のコード:**

```javascript
if (!res.ok) {
  const errorBody = await res.text();
  let errorMessage = `Dify blocking error ${res.status} ${res.statusText}`;
  try {
    const errorJson = JSON.parse(errorBody);
    errorMessage += `: ${JSON.stringify(errorJson)}`;
  } catch {
    errorMessage += `: ${errorBody}`;
  }
  
  // 500エラーの場合はフォールバックメッセージを返す
  if (res.status === 500) {
    console.error(`Dify API 500エラー: ${errorMessage}`);
    // エラーをスローせず、フォールバックメッセージを返す
    return {
      answer: buildFallbackAnswer('Dify APIで一時的なエラーが発生しました。しばらく待ってから再度お試しください。'),
      meta: {},
      conversation_id: conversationId ?? null,
    };
  }
  
  throw new Error(errorMessage);
}
```

## 🚀 次のステップ

### 1. Functionsの再デプロイ

```bash
cd "/Users/jin/Library/CloudStorage/Dropbox/NEW WORLD/1101 new"
firebase deploy --only functions:processVideoJob
```

### 2. テスト実施

**小さな動画でテスト:**
- 形式: mp4
- 長さ: 5-10秒
- サイズ: < 50MB

**確認事項:**
- [ ] 動画受領メッセージが届く
- [ ] `processVideoJob`が正常に実行される（ログで確認）
- [ ] Dify APIが500エラーを返した場合でも、フォールバックメッセージがLINEに送信される
- [ ] LINE Botからメッセージが届く（解析結果またはフォールバックメッセージ）

### 3. ログ確認

```bash
# processVideoJobのログを確認
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="processvideojob" AND (textPayload=~"processVideoJob開始" OR textPayload=~"processVideoJob成功" OR textPayload=~"LINE Webhookリクエスト")' \
  --limit=10 \
  --format="table(timestamp,severity,textPayload)" \
  --project=aikaapp-584fa \
  --freshness=10m

# Dify APIのエラーログを確認
gcloud logging read 'textPayload=~"Dify API 500エラー"' \
  --limit=10 \
  --format="table(timestamp,severity,textPayload)" \
  --project=aikaapp-584fa \
  --freshness=10m

# LINE送信のログを確認
gcloud logging read 'textPayload=~"sendLineMessage" OR textPayload=~"LINEメッセージ送信成功"' \
  --limit=10 \
  --format="table(timestamp,severity,textPayload)" \
  --project=aikaapp-584fa \
  --freshness=10m
```

## 🔍 期待される動作

### 正常ケース
1. 動画アップロード
2. `lineWebhookRouter`が`processVideoJob`を呼び出し
3. `processVideoJob`がDify APIを呼び出し
4. Dify APIが解析結果を返す
5. LINE Botに解析結果を送信

### Dify API 500エラーケース
1. 動画アップロード
2. `lineWebhookRouter`が`processVideoJob`を呼び出し
3. `processVideoJob`がDify APIを呼び出し
4. Dify APIが500エラーを返す
5. **フォールバックメッセージをLINE Botに送信**（新機能）
6. ユーザーにエラーを知らせる

### LINE Webhook混入ケース
1. LINE Webhookが`processVideoJob`に直接送信される
2. `processVideoJob`がLINE Webhookのリクエストを検知
3. **リクエストを無視して200を返す**（新機能）
4. `lineWebhookRouter`で処理される

## 📋 チェックリスト

- [x] LINE Webhookのリクエストを無視する処理を追加
- [x] Dify APIの500エラーハンドリングを改善
- [x] フォールバックメッセージを返す処理を追加
- [x] デバッグログを追加
- [x] 構文チェック成功
- [ ] Functionsの再デプロイ
- [ ] テスト実施
- [ ] ログ確認
- [ ] Dify API 500エラー時の動作確認
- [ ] LINE Webhook混入時の動作確認

---

**最終更新:** 2025-11-08
**ステータス:** 修正完了、デプロイ待ち ✅

