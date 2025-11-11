# 🔄 reply API再試行ガイド

## 📋 状況

- ✅ **push API:** 成功
- ❌ **reply API:** Invalid reply token エラー

## 🔍 原因

`Invalid reply token`エラーは以下の原因で発生します：

1. **古いreplyTokenを使用している**
   - 以前のWebhookイベントのreplyTokenを使用している

2. **replyTokenの再利用**
   - 同じreplyTokenを2回以上使用している

3. **受信から時間経過**
   - replyTokenは受信直後に使用する必要がある
   - 時間が経過すると無効になる

## ✅ 解決方法

### 方法1: 再試行スクリプトを使用（推奨）

```bash
./reply_retry.sh
```

このスクリプトは以下を自動で実行します：
1. 最新のWebhookイベントから`replyToken`を取得
2. その`replyToken`を使って即座にreply APIを呼び出す

### 方法2: 手動で再試行

```bash
# 1. 最新のWebhookイベントからreplyTokenを取得
REPLY_TOKEN=$(gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="linewebhookrouter" AND textPayload=~"動画メッセージ"' \
  --limit=1 \
  --format="json" \
  --project=aikaapp-584fa \
  --freshness=10m | \
  python3 -c "
import sys, json
data = json.load(sys.stdin)
if data and len(data) > 0:
    text = data[0].get('textPayload', '')
    if text:
        body = json.loads(text)
        if 'events' in body and len(body['events']) > 0:
            print(body['events'][0].get('replyToken', ''))
")

# 2. LINEチャネルアクセストークンを取得
TOKEN=$(gcloud secrets versions access latest --secret=LINE_CHANNEL_ACCESS_TOKEN --project=aikaapp-584fa)

# 3. reply APIを呼び出し
curl -X POST 'https://api.line.me/v2/bot/message/reply' \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d "{
    \"replyToken\": \"${REPLY_TOKEN}\",
    \"messages\": [
      {
        \"type\": \"text\",
        \"text\": \"動画を受け付けました！AIが解析を開始します。\\n\\n結果が届くまで、しばらくお待ちください…\\n\\n※解析は20秒以内/100MB以下の動画が対象です。\"
      }
    ]
  }"
```

## 💡 重要なポイント

### replyTokenの使用ルール

1. **受信直後に使用**
   - Webhookイベントを受信したら、すぐにreply APIを呼び出す
   - 時間が経過すると無効になる

2. **最新のreplyTokenを使用**
   - 必ず最新のWebhookイベントから`replyToken`を取得する
   - 古い`replyToken`は使用しない

3. **1回だけ使用**
   - 同じ`replyToken`は1回だけ使用できる
   - 再利用すると`Invalid reply token`エラーになる

### 現在の実装

`functions/index.js`の`lineWebhookRouter`では、以下のように実装されています：

```javascript
// Webhookイベントを受信したら、すぐにreply APIを呼び出す
await lineClient.replyMessage(event.replyToken, replyMessage);
```

この実装は正しいですが、もしエラーが発生した場合は、最新のWebhookイベントから`replyToken`を取得して再試行してください。

## 🔄 再試行手順

1. **新しい動画を送信**
   - LINEアプリでFLATUPGYMに新しいテスト動画を送信
   - これにより、最新のWebhookイベントが生成される

2. **再試行スクリプトを実行**
   ```bash
   ./reply_retry.sh
   ```

3. **結果を確認**
   - HTTP 200が返れば成功
   - LINEアプリに「動画を受け付けました…」が届く

## 📊 成功の基準

以下のすべてが確認できれば、**完全成功**です：

1. ✅ **reply API成功**
   - HTTP 200が返る
   - LINEアプリに「動画を受け付けました…」が届く

2. ✅ **push API成功**
   - 既に成功している
   - LINEアプリにDifyの解析結果またはフォールバックメッセージが届く

---

**最終更新:** 2025-11-08  
**ステータス:** reply API再試行準備完了 ✅

