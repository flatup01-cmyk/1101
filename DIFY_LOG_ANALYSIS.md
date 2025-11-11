# 🔍 processVideoJobの詳細ログ確認ガイド

## 📊 ログ確認結果

### 確認された問題

1. **Dify API 500エラーが発生**
   - エラーメッセージ: `{"code":"internal_server_error","message":"The server encountered an internal error and was unable to complete your request. Either the server is overloaded or there is an error in the application.","status":500}`
   - パス構造は修正済み（`videos/`接頭辞なし）
   - videoUrl: `https://storage.googleapis.com/aikaapp-584fa.firebasestorage.app/U521cd38b7f048be84eaa880ccabdc7f9/586835248139731218.mp4`

2. **フォールバックメッセージが返されている**
   - 500エラー時にフォールバックメッセージを返す実装が動作している
   - ユーザーには「Dify APIで一時的なエラーが発生しました。しばらく待ってから再度お試しください。」が届いている

---

## 🔍 詳細ログ確認方法

### 方法1: ログ確認スクリプトを使用（推奨）

```bash
./check_dify_logs.sh
```

このスクリプトは以下を確認します：
- 最新のエラーログ（Dify API関連）
- 最新のprocessVideoJobログ（全体）
- Dify API呼び出しの詳細ログ
- スタックトレース（エラー詳細）

### 方法2: 手動で確認

```bash
# エラーログを確認
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="processvideojob" AND severity>=ERROR' \
  --limit=10 \
  --format="json" \
  --project=aikaapp-584fa \
  --freshness=1h

# Dify API関連のログを確認
gcloud logging read 'textPayload=~"Dify API\|analyzeVideoBlocking\|handleVideoJob"' \
  --limit=20 \
  --format="table(timestamp,severity,textPayload)" \
  --project=aikaapp-584fa \
  --freshness=1h
```

---

## 🔧 追加したデバッグログ

### Dify APIリクエストの詳細ログ

`functions/dify/dify.js`に以下を追加しました：

```javascript
// Dify APIリクエストの詳細をログ出力（デバッグ用）
console.info('Dify APIリクエスト:', JSON.stringify({
  url: 'https://api.dify.ai/v1/chat-messages',
  method: 'POST',
  videoUrl: videoUrl,
  userId: userId,
  conversationId: conversationId ?? null,
}));
```

### Dify APIエラーの詳細ログ

```javascript
// 詳細なエラー情報をログ出力
console.error('Dify APIエラー詳細:', JSON.stringify({
  status: res.status,
  statusText: res.statusText,
  errorBody: errorBody,
  errorJson: errorJson,
  videoUrl: videoUrl,
  requestHeaders: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ***',
  },
}));
```

---

## 📋 確認ポイント

### 1. Dify API呼び出し時のエラーコード
- 現在: 500 Internal Server Error
- 原因: Dify側のサーバーエラーまたは動画URLへのアクセス権限の問題

### 2. スタックトレース
- エラーの発生箇所を特定
- 呼び出しチェーンを確認

### 3. Difyからのレスポンスボディ
- エラーメッセージの詳細
- エラーコードとステータス

### 4. パス構造エラーの詳細
- パス構造は修正済み（`videos/`接頭辞なし）
- videoUrlは正しい形式

---

## 🔍 次のステップ

### 1. Difyの公式情報を確認

- Difyのステータスページを確認
- 障害情報やメンテナンス情報を確認
- APIドキュメントで動画URLの形式要件を確認

### 2. APIキーを再確認

```bash
# Dify APIキーを確認（Secret Manager）
gcloud secrets versions access latest --secret=DIFY_API_KEY --project=aikaapp-584fa
```

### 3. APIクライアントツールでテスト

PostmanなどのAPIテストツールで、同じリクエストをDify APIに直接送信：

```bash
# curlでテスト
TOKEN=$(gcloud secrets versions access latest --secret=DIFY_API_KEY --project=aikaapp-584fa)
VIDEO_URL="https://storage.googleapis.com/aikaapp-584fa.firebasestorage.app/U521cd38b7f048be84eaa880ccabdc7f9/586835248139731218.mp4"

curl -X POST 'https://api.dify.ai/v1/chat-messages' \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d "{
    \"query\": \"この動画を解析し、要約と重要イベントを返してください。\",
    \"inputs\": { \"source\": \"line\" },
    \"response_mode\": \"blocking\",
    \"user\": \"test_user\",
    \"conversation_id\": \"\",
    \"files\": [{ \"type\": \"video\", \"transfer_method\": \"remote_url\", \"url\": \"${VIDEO_URL}\" }],
    \"auto_generate_name\": true
  }"
```

---

## ✅ 改善内容

- ✅ 詳細ログ確認スクリプト作成済み（`./check_dify_logs.sh`）
- ✅ Dify APIリクエストの詳細ログを追加
- ✅ Dify APIエラーの詳細ログを追加
- ✅ パス構造は修正済み（`videos/`接頭辞なし）

---

**最終更新:** 2025-11-08  
**ステータス:** 詳細ログ確認準備完了 ✅

