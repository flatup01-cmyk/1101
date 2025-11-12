# 🎯 Webhook JSON確認とreply→push検証手順

## 📋 手順概要

1. **Webhook JSONから値を取得**
   - `events[0].replyToken` → reply APIで使用
   - `events[0].source.userId` → push APIで使用

2. **reply APIで即座に返信**
   - 「解析中です」を送信
   - レスポンスが2xxであることを確認

3. **push APIで結果を送信**
   - Difyのanswerをpushで送信
   - レスポンスが2xxであることを確認

4. **エラー時は本文のメッセージで原因を切り分け**

---

## 🔍 ステップ1: Webhook JSONの確認

### Cloud Loggingで受信JSONを確認

```bash
# 最新のWebhook受信ログを確認
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="linewebhookrouter" AND textPayload=~"動画メッセージ"' \
  --limit=5 \
  --format="json" \
  --project=aikaapp-584fa \
  --freshness=10m | \
  jq -r '.[] | select(.textPayload != null) | .textPayload' | \
  jq -r 'select(.events != null) | .events[0] | {replyToken, userId: .source.userId}'
```

### 期待される出力例

```json
{
  "replyToken": "82daef79ee744e1e933f1a44082fa43a",
  "userId": "U521cd38b7f048be84eaa880ccabdc7f9"
}
```

---

## ✅ ステップ2: reply APIの確認

### 現在の実装確認

`functions/index.js`の`lineWebhookRouter`で、以下のように実装されています：

```javascript
// reply APIで即座に返信
const replyMessage = {
  type: 'text',
  text: '動画を受け付けました！AIが解析を開始します。\n\n結果が届くまで、しばらくお待ちください…\n\n※解析は20秒以内/100MB以下の動画が対象です。'
};
await lineClient.replyMessage(event.replyToken, replyMessage);
console.info("ユーザーへの受付完了メッセージの送信に成功しました。");
```

### reply APIのレスポンス確認

```bash
# reply APIの成功ログを確認
gcloud logging read 'textPayload=~"ユーザーへの受付完了メッセージの送信に成功" OR textPayload=~"replyMessage"' \
  --limit=10 \
  --format="table(timestamp,severity,textPayload)" \
  --project=aikaapp-584fa \
  --freshness=10m
```

**期待される結果:**
- `ユーザーへの受付完了メッセージの送信に成功しました。`というログが出力される
- LINEアプリに「動画を受け付けました…」というメッセージが届く

---

## ✅ ステップ3: push APIの確認

### 現在の実装確認

`functions/dify/handler.js`の`sendLineMessage`関数で、以下のように実装されています：

```javascript
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

### push APIのレスポンス確認

```bash
# push APIの成功ログを確認
gcloud logging read 'textPayload=~"sendLineMessage" OR textPayload=~"LINEメッセージ送信成功" OR textPayload=~"LINE push error"' \
  --limit=10 \
  --format="table(timestamp,severity,textPayload)" \
  --project=aikaapp-584fa \
  --freshness=10m
```

**期待される結果:**
- `sendLineMessage`が正常に実行される
- LINEアプリにDifyの解析結果またはフォールバックメッセージが届く

---

## 🔍 エラー時の原因切り分け

### reply APIエラーの場合

```bash
# reply APIのエラーログを確認
gcloud logging read 'severity>=ERROR AND textPayload=~"replyMessage\|reply error"' \
  --limit=10 \
  --format="json" \
  --project=aikaapp-584fa \
  --freshness=10m | \
  jq -r '.[] | {timestamp, message: .textPayload, error: .jsonPayload.error}'
```

**よくあるエラー:**
- `400 Bad Request`: replyTokenが無効または期限切れ
- `401 Unauthorized`: チャネルアクセストークンが無効
- `429 Too Many Requests`: レート制限超過

### push APIエラーの場合

```bash
# push APIのエラーログを確認
gcloud logging read 'severity>=ERROR AND textPayload=~"LINE push error\|sendLineMessage"' \
  --limit=10 \
  --format="json" \
  --project=aikaapp-584fa \
  --freshness=10m | \
  jq -r '.[] | {timestamp, message: .textPayload, error: .jsonPayload.error}'
```

**よくあるエラー:**
- `400 Bad Request`: userIdが無効、またはメッセージ形式が不正
- `401 Unauthorized`: チャネルアクセストークンが無効
- `429 Too Many Requests`: レート制限超過
- `500 Internal Server Error`: LINE API側のエラー

---

## 📊 完全な検証コマンド

### 一括確認スクリプト

```bash
#!/bin/bash
# reply→push検証スクリプト

echo "=== Webhook JSON確認 ==="
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="linewebhookrouter" AND textPayload=~"動画メッセージ"' \
  --limit=1 \
  --format="json" \
  --project=aikaapp-584fa \
  --freshness=10m | \
  jq -r '.[] | select(.textPayload != null) | .textPayload' | \
  jq -r 'select(.events != null) | .events[0] | "replyToken: \(.replyToken)\nuserId: \(.source.userId)"'

echo ""
echo "=== reply API確認 ==="
gcloud logging read 'textPayload=~"ユーザーへの受付完了メッセージの送信に成功"' \
  --limit=1 \
  --format="table(timestamp,severity,textPayload)" \
  --project=aikaapp-584fa \
  --freshness=10m

echo ""
echo "=== push API確認 ==="
gcloud logging read 'textPayload=~"sendLineMessage\|LINE push error"' \
  --limit=5 \
  --format="table(timestamp,severity,textPayload)" \
  --project=aikaapp-584fa \
  --freshness=10m

echo ""
echo "=== エラーログ確認 ==="
gcloud logging read 'severity>=ERROR AND (textPayload=~"LINE\|reply\|push")' \
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
   - LINEアプリに「動画を受け付けました…」が届く

3. ✅ **push API成功**
   - レスポンスが2xx
   - LINEアプリにDifyの解析結果またはフォールバックメッセージが届く

---

**最終更新:** 2025-11-08  
**ステータス:** 検証手順完成 ✅

