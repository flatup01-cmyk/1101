# 解析結果Push未到達の問題 - 修正完了報告

## 🔍 問題の状況

- ✅ 動画受領メッセージは届いている
- ✅ `lineWebhookRouter`は`processVideoJob`を呼び出している
- ❌ 解析結果のPushが届いていない
- ❌ 画面が止まって見える

## 📊 ログ分析結果

### 確認された問題

1. **`lineWebhookRouter`側**
   - ✅ 動画をCloud Storageに保存
   - ⚠️ `fetch`が非同期で実行されていた（`await`なし）
   - ⚠️ エラーハンドリングが不足

2. **`processVideoJob`側**
   - ⚠️ `req.body`のパース確認が必要
   - ✅ `DIFY_API_KEY`の設定は完了

## ✅ 実施した修正

### 1. lineWebhookRouter側の修正 ✅

**変更内容:**
- `fetch`に`await`を追加
- エラーハンドリングを追加
- レスポンスの確認を追加
- デバッグログを追加

**修正後のコード:**

```javascript
const processVideoJobUrl = process.env.PROCESS_VIDEO_JOB_URL;
console.info(`Dify処理関数 (processVideoJob) の呼び出しを開始します。URL: ${processVideoJobUrl}`);
const processResponse = await fetch(processVideoJobUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        jobId: messageId,
        lineUserId: userId,
        videoUrl: videoUrl,
    })
});
if (!processResponse.ok) {
  const errorText = await processResponse.text();
  console.error(`processVideoJob呼び出しエラー: ${processResponse.status} ${processResponse.statusText}`, errorText);
} else {
  const result = await processResponse.json();
  console.info(`processVideoJob呼び出し成功:`, JSON.stringify(result));
}
```

### 2. processVideoJob側の修正 ✅

**変更内容:**
- デバッグログを追加（`req.method`, `Content-Type`, `req.body`の型と内容）
- パラメータの検証を追加
- エラーハンドリングを改善

**修正後のコード:**

```javascript
export const processVideoJob = onRequest(
  {
    secrets: ["DIFY_API_KEY", "LINE_CHANNEL_ACCESS_TOKEN"],
    timeoutSeconds: 180,
  },
  async (req, res) => {
    console.info("processVideoJob受信 - リクエストメソッド:", req.method);
    console.info("processVideoJob受信 - Content-Type:", req.headers["content-type"]);
    console.info("processVideoJob受信 - req.body型:", typeof req.body);
    console.info("processVideoJob受信 - req.body:", JSON.stringify(req.body));
    try {
      const { jobId, lineUserId, videoUrl } = req.body;
      if (!videoUrl) throw new Error("videoUrl is required");
      if (!lineUserId) throw new Error("lineUserId is required");
      const result = await handleVideoJob({
        jobId: jobId || lineUserId,
        userId: lineUserId,
        lineUserId: lineUserId,
        videoUrl: videoUrl,
        useStreaming: false,
        conversationId: null,
        extraJobData: {},
      });
      res.status(200).json({ ok: true, result });
    } catch (error) {
      console.error("processVideoJobでエラー:", error);
      res.status(500).json({ ok: false, error: error.message });
    }
  }
);
```

## 🚀 次のステップ

### 1. Functionsの再デプロイ

```bash
cd "/Users/jin/Library/CloudStorage/Dropbox/NEW WORLD/1101 new"
firebase deploy --only functions:lineWebhookRouter,functions:processVideoJob
```

### 2. テスト実施

**小さな動画でテスト:**
- 形式: mp4
- 長さ: 5-10秒
- サイズ: < 50MB

**確認事項:**
- [ ] 動画受領メッセージが届く
- [ ] `processVideoJob`が正常に実行される（ログで確認）
- [ ] 解析が完了する
- [ ] LINE Botから解析完了メッセージが届く

### 3. ログ確認

```bash
# processVideoJobの詳細ログを確認
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="processvideojob" AND textPayload=~"processVideoJob受信"' \
  --limit=10 \
  --format="table(timestamp,severity,textPayload)" \
  --project=aikaapp-584fa \
  --freshness=10m

# lineWebhookRouterのログを確認
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="linewebhookrouter" AND textPayload=~"processVideoJob"' \
  --limit=10 \
  --format="table(timestamp,severity,textPayload)" \
  --project=aikaapp-584fa \
  --freshness=10m

# エラーの有無を確認
gcloud logging read 'severity>=ERROR AND (resource.labels.service_name="processvideojob" OR resource.labels.service_name="linewebhookrouter")' \
  --limit=10 \
  --format="json" \
  --project=aikaapp-584fa \
  --freshness=10m

# 成功ログの確認
gcloud logging read 'textPayload=~"processVideoJob呼び出し成功" OR textPayload=~"sendLineMessage" OR textPayload=~"解析完了"' \
  --limit=10 \
  --format="table(timestamp,severity,textPayload)" \
  --project=aikaapp-584fa \
  --freshness=10m
```

## 🔍 確認ポイント

### 1. req.bodyの内容確認

デプロイ後、以下のログで`req.body`の内容を確認：

```
processVideoJob受信 - req.body: {"jobId":"...","lineUserId":"...","videoUrl":"..."}
```

期待される形式:
```json
{
  "jobId": "586813350819135916",
  "lineUserId": "U521cd38b7f048be84eaa880ccabdc7f9",
  "videoUrl": "https://storage.googleapis.com/aikaapp-584fa.firebasestorage.app/videos/..."
}
```

### 2. videoUrlの形式確認

`videoUrl`が以下の形式になっているか確認：
```
https://storage.googleapis.com/aikaapp-584fa.firebasestorage.app/videos/U521cd38b7f048be84eaa880ccabdc7f9/586813350819135916.mp4
```

### 3. レスポンスの確認

`processVideoJob`からのレスポンスが正常か確認：
```
processVideoJob呼び出し成功: {"ok":true,"result":{"answer":"...","conversation_id":"..."}}
```

### 4. LINE送信の確認

`handleVideoJob`内で`sendLineMessage`が呼び出されているか確認：
```
sendLineMessage呼び出し成功
```

## 📋 チェックリスト

- [x] `fetch`に`await`を追加
- [x] エラーハンドリングを追加
- [x] デバッグログを追加（`lineWebhookRouter`側）
- [x] デバッグログを追加（`processVideoJob`側）
- [x] 構文チェック成功
- [ ] Functionsの再デプロイ
- [ ] テスト実施
- [ ] ログ確認
- [ ] `req.body`の内容確認
- [ ] `videoUrl`の形式確認
- [ ] レスポンスの確認
- [ ] LINE送信の確認

---

**最終更新:** 2025-11-08
**ステータス:** 修正完了、デプロイ待ち ✅
