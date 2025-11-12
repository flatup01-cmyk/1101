# 解析ジョブ完了通知の問題 - 修正完了報告

## 🔍 問題の原因

1. **`DIFY_API_KEY`環境変数が未設定**
   - `processVideoJob`関数で`DIFY_API_KEY`がSecret Managerから読み込めていなかった
   - エラー: `Error: Environment variable DIFY_API_KEY is required`

2. **`videoUrl`パラメータの受け渡し問題**
   - `req.body`から正しくパラメータを取得できていない可能性
   - エラー: `Error: videoUrl is required`

3. **`userId`パラメータの欠落**
   - `handleVideoJob`は`userId`と`lineUserId`の両方を必要とするが、`lineWebhookRouter`からは`lineUserId`のみ送信されていた

---

## ✅ 実施した修正

### 1. DIFY_API_KEYのSecret Manager作成 ✅

```bash
# Secret ManagerにDIFY_API_KEYを作成
echo -n "app-6OBnNxu0oWUiMVVq0rjepVhJ" | \
  gcloud secrets create DIFY_API_KEY \
  --data-file=- \
  --project=aikaapp-584fa

# Secretへのアクセス権限を付与
gcloud secrets add-iam-policy-binding DIFY_API_KEY \
  --member="serviceAccount:639286700347-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project=aikaapp-584fa
```

**結果:** ✅ 完了

### 2. processVideoJob関数の修正 ✅

**変更内容:**
- `secrets`配列に`DIFY_API_KEY`と`LINE_CHANNEL_ACCESS_TOKEN`を追加
- タイムアウトを180秒に設定
- `req.body`からパラメータを明示的に取得
- 必須パラメータの検証を追加
- `userId`パラメータを`lineUserId`から生成
- デバッグログを追加

**修正後のコード:**

```javascript
export const processVideoJob = onRequest(
  {
    secrets: ["DIFY_API_KEY", "LINE_CHANNEL_ACCESS_TOKEN"],
    timeoutSeconds: 180,
  },
  async (req, res) => {
    try {
      console.info("processVideoJob受信:", JSON.stringify(req.body));
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

**結果:** ✅ 完了（構文チェック成功）

---

## 🚀 次のステップ

### 1. Functionsの再デプロイ

```bash
cd "/Users/jin/Library/CloudStorage/Dropbox/NEW WORLD/1101 new"
firebase deploy --only functions:processVideoJob
```

### 2. テスト実施

1. **小さな動画でテスト**
   - 形式: mp4
   - 長さ: 5-10秒
   - サイズ: < 50MB

2. **確認事項:**
   - [ ] 動画受領メッセージが届く
   - [ ] `processVideoJob`が正常に実行される（ログで確認）
   - [ ] 解析が完了する
   - [ ] LINE Botから解析完了メッセージが届く

### 3. ログ確認

```bash
# processVideoJobのログを確認
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="processvideojob"' \
  --limit=20 \
  --format="table(timestamp,severity,textPayload,jsonPayload.message)" \
  --project=aikaapp-584fa \
  --freshness=10m

# エラーの有無を確認
gcloud logging read 'severity>=ERROR AND resource.labels.service_name="processvideojob"' \
  --limit=10 \
  --format="json" \
  --project=aikaapp-584fa \
  --freshness=10m

# 成功ログの確認
gcloud logging read 'textPayload=~"processVideoJob受信" OR textPayload=~"✅"' \
  --limit=10 \
  --format="table(timestamp,severity,textPayload)" \
  --project=aikaapp-584fa \
  --freshness=10m
```

---

## 📊 修正前後の比較

### 修正前
- ❌ `DIFY_API_KEY`が未設定 → エラー発生
- ❌ `req.body`をそのまま渡していた → パラメータ不足
- ❌ `userId`が欠落 → エラー発生
- ❌ タイムアウトが60秒 → 短すぎる可能性

### 修正後
- ✅ `DIFY_API_KEY`をSecret Managerから読み込み
- ✅ `req.body`からパラメータを明示的に取得
- ✅ `userId`を`lineUserId`から生成
- ✅ 必須パラメータの検証を追加
- ✅ デバッグログを追加
- ✅ タイムアウトを180秒に延長

---

## ✅ チェックリスト

- [x] `DIFY_API_KEY`をSecret Managerに作成
- [x] Secretへのアクセス権限を付与
- [x] `processVideoJob`関数の`secrets`配列に追加
- [x] `req.body`のパラメータ取得を修正
- [x] `userId`パラメータの生成を追加
- [x] 必須パラメータの検証を追加
- [x] タイムアウトを180秒に延長
- [x] デバッグログを追加
- [x] 構文チェック成功
- [ ] Functionsの再デプロイ
- [ ] テスト実施
- [ ] ログ確認

---

## 🎯 期待される動作

修正後、以下のフローが正常に動作するはずです：

1. **動画アップロード**
   - LINE Botから動画を受信
   - `lineWebhookRouter`が動画をCloud Storageに保存
   - 受領メッセージを送信

2. **解析ジョブの開始**
   - `lineWebhookRouter`が`processVideoJob`を呼び出し
   - `processVideoJob`が`DIFY_API_KEY`を読み込み
   - `handleVideoJob`が実行される

3. **解析処理**
   - Dify APIが呼び出される
   - 解析結果が取得される

4. **結果通知**
   - LINE Botに解析結果が送信される
   - Firestoreに結果が保存される

---

**最終更新:** 2025-11-08
**ステータス:** 修正完了、デプロイ待ち ✅
