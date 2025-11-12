# 🎯 reply→push検証手順（最終版）

## 📋 検証フロー

1. **Webhook JSONから値を取得**
   - `events[0].replyToken` → reply APIで使用
   - `events[0].source.userId` → push APIで使用

2. **reply APIで即座に返信**
   - 到着直後に「解析中です」を返信
   - レスポンスが2xxであることを確認

3. **push APIで結果を送信**
   - Difyのanswerをpushで送信
   - レスポンスが2xxであることを確認

4. **エラー時は本文の説明で原因を特定**

---

## 🔍 検証方法

### 方法1: 詳細検証スクリプト（推奨）

```bash
./verify_reply_push_detailed.sh
```

このスクリプトは以下を自動で確認します：
- Webhook JSONから`replyToken`と`userId`を抽出
- reply APIの成功ログ（2xx確認）
- push APIの成功ログ（2xx確認）
- エラーログの有無

### 方法2: 簡易検証スクリプト

```bash
./verify_reply_push.sh
```

### 方法3: 手動確認

```bash
# Webhook JSON確認
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="linewebhookrouter" AND textPayload=~"動画メッセージ"' \
  --limit=1 \
  --format="json" \
  --project=aikaapp-584fa \
  --freshness=10m | \
  jq -r '.[] | select(.textPayload != null) | .textPayload' | \
  jq -r 'select(.events != null) | .events[0] | {replyToken, userId: .source.userId}'

# reply API確認
gcloud logging read 'textPayload=~"ユーザーへの受付完了メッセージの送信に成功"' \
  --limit=1 \
  --format="table(timestamp,severity,textPayload)" \
  --project=aikaapp-584fa \
  --freshness=10m

# push API確認
gcloud logging read 'textPayload=~"sendLineMessage\|processVideoJob成功"' \
  --limit=5 \
  --format="table(timestamp,severity,textPayload)" \
  --project=aikaapp-584fa \
  --freshness=10m
```

---

## ✅ 成功の基準

以下のすべてが確認できれば、**完全成功**です：

1. ✅ **Webhook JSON確認**
   - `events[0].replyToken`が取得できる
   - `events[0].source.userId`が取得できる

2. ✅ **reply API成功**
   - レスポンスが2xx
   - ログに「ユーザーへの受付完了メッセージの送信に成功しました。」が出力される
   - LINEアプリに「動画を受け付けました…」が届く

3. ✅ **push API成功**
   - レスポンスが2xx
   - ログに`processVideoJob成功`が出力される
   - LINEアプリにDifyの解析結果またはフォールバックメッセージが届く

---

## 🔍 エラー時の原因切り分け

### reply APIエラーの場合

**ログで確認:**
```bash
gcloud logging read 'severity>=ERROR AND textPayload=~"reply\|replyMessage"' \
  --limit=5 \
  --format="json" \
  --project=aikaapp-584fa \
  --freshness=10m | \
  jq -r '.[] | {timestamp, message: .textPayload, error: .jsonPayload.error}'
```

**よくあるエラーと原因:**
- `400 Bad Request`: replyTokenが無効または期限切れ
- `401 Unauthorized`: チャネルアクセストークンが無効
- `429 Too Many Requests`: レート制限超過

### push APIエラーの場合

**ログで確認:**
```bash
gcloud logging read 'severity>=ERROR AND textPayload=~"LINE push error\|sendLineMessage"' \
  --limit=5 \
  --format="json" \
  --project=aikaapp-584fa \
  --freshness=10m | \
  jq -r '.[] | {timestamp, message: .textPayload, error: .jsonPayload.error}'
```

**よくあるエラーと原因:**
- `400 Bad Request`: userIdが無効、またはメッセージ形式が不正
- `401 Unauthorized`: チャネルアクセストークンが無効
- `429 Too Many Requests`: レート制限超過
- `500 Internal Server Error`: LINE API側のエラー

---

## 📊 実装確認

### 現在の実装

**reply API（即座に返信）:**
```javascript
// functions/index.js - lineWebhookRouter
const replyMessage = {
  type: 'text',
  text: '動画を受け付けました！AIが解析を開始します。\n\n結果が届くまで、しばらくお待ちください…\n\n※解析は20秒以内/100MB以下の動画が対象です。'
};
await lineClient.replyMessage(event.replyToken, replyMessage);
console.info("ユーザーへの受付完了メッセージの送信に成功しました。");
```

**push API（結果送信）:**
```javascript
// functions/dify/handler.js - sendLineMessage
async function sendLineMessage(to, text) {
  const token = requireEnv('LINE_CHANNEL_ACCESS_TOKEN');
  const url = 'https://api.line.me/v2/bot/message/push';
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  const body = JSON.stringify({
    to,
    messages: [{ type: 'text', text }],
  });
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LINE push error ${res.status} ${res.statusText}: ${body}`);
  }
}
```

---

## 🎯 テスト手順

1. **テスト動画を送信**
   - LINEアプリでFLATUPGYMにテスト動画を送信

2. **証①を確認（即時）**
   - 数秒以内に「動画を受け付けました…」が届く
   - これはreply APIの成功を示す

3. **検証スクリプトを実行**
   ```bash
   ./verify_reply_push_detailed.sh
   ```

4. **証②を確認（ログ）**
   - reply APIの成功ログ
   - push APIの成功ログ

5. **証③を確認（最終結果）**
   - 1-3分以内にLINEメッセージが届く
   - これはpush APIの成功を示す

---

**最終更新:** 2025-11-08  
**ステータス:** 検証手順完成 ✅

