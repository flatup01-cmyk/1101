#!/bin/bash
# 最新のreplyTokenで即座にreply APIを呼び出す

echo "=== 最新のreplyTokenで即座にreply APIを呼び出し ==="
echo ""

# 最新のWebhookログからreplyTokenを取得
WEBHOOK_LOG=$(gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="linewebhookrouter" AND textPayload=~"Webhook受信JSON"' \
  --limit=1 \
  --format="json" \
  --project=aikaapp-584fa \
  --freshness=2m 2>/dev/null)

if [ -z "$WEBHOOK_LOG" ] || [ "$WEBHOOK_LOG" = "[]" ]; then
  echo "❌ 最新のWebhookログが見つかりません"
  echo "   LINEボットに新しいメッセージを送信してください"
  exit 1
fi

# replyTokenを抽出
REPLY_TOKEN=$(echo "$WEBHOOK_LOG" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    if data and len(data) > 0:
        text = data[0].get('textPayload', '')
        if text:
            import json as j
            try:
                # 'Webhook受信JSON: 'の後を取得
                json_str = text.split('Webhook受信JSON: ', 1)[1]
                body = j.loads(json_str)
                if 'events' in body and len(body['events']) > 0:
                    token = body['events'][0].get('replyToken', '')
                    print(token)
            except Exception as e:
                print('')
except:
    print('')
" 2>/dev/null)

if [ -z "$REPLY_TOKEN" ]; then
  echo "❌ replyTokenが取得できませんでした"
  echo "   ログを確認してください:"
  echo "$WEBHOOK_LOG" | python3 -m json.tool | head -20
  exit 1
fi

echo "✅ 最新のreplyTokenを取得: $REPLY_TOKEN"
echo ""

# LINEチャネルアクセストークンを取得（Secretから、改行をstrip）
TOKEN=$(gcloud secrets versions access latest --secret=LINE_CHANNEL_ACCESS_TOKEN --project=aikaapp-584fa 2>/dev/null | tr -d '\n\r ')

if [ -z "$TOKEN" ]; then
  echo "❌ LINEチャネルアクセストークンが取得できませんでした"
  exit 1
fi

echo "📤 reply APIを呼び出し中..."
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST 'https://api.line.me/v2/bot/message/reply' \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d "{\"replyToken\":\"${REPLY_TOKEN}\",\"messages\":[{\"type\":\"text\",\"text\":\"replyToken検証: このメッセージが届けば成功です！\"}]}" 2>&1)

HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_CODE:/d')

echo ""
if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ reply API成功: HTTP $HTTP_CODE"
  echo "   レスポンス: $BODY"
  echo ""
  echo "🎉 成功！LINEアプリでメッセージが届いているか確認してください。"
else
  echo "❌ reply APIエラー: HTTP $HTTP_CODE"
  echo "   レスポンス: $BODY"
  echo ""
  echo "💡 ヒント:"
  echo "   - replyTokenが既に使用済みの可能性があります"
  echo "   - LINEボットに新しいメッセージを送信して、最新のreplyTokenを取得してください"
  echo "   - メッセージ送信後、数秒以内にこのスクリプトを実行してください"
fi
