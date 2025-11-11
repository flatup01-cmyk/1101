#!/bin/bash
# replyToken検証スクリプト（デプロイ後）

echo "=== replyToken検証手順 ==="
echo ""
echo "📱 ステップ1: LINEボットに一言送信"
echo "   LINEアプリでFLATUPGYMに任意のメッセージを送信してください"
echo ""
read -p "メッセージを送信したらEnterキーを押してください..."

echo ""
echo "📊 ステップ2: 最新のWebhook受信JSONを確認"
echo ""

WEBHOOK_LOG=$(gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="linewebhookrouter" AND textPayload=~"Webhook受信JSON"' \
  --limit=1 \
  --format="json" \
  --project=aikaapp-584fa \
  --freshness=2m 2>/dev/null)

if [ -z "$WEBHOOK_LOG" ] || [ "$WEBHOOK_LOG" = "[]" ]; then
  echo "⚠️  Webhookログが見つかりません"
  echo "   もう一度メッセージを送信してください"
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
                    print(body['events'][0].get('replyToken', ''))
            except:
                pass
except:
    pass
" 2>/dev/null)

if [ -z "$REPLY_TOKEN" ]; then
  echo "⚠️  replyTokenが取得できませんでした"
  echo "   ログを確認してください:"
  echo "$WEBHOOK_LOG" | python3 -m json.tool | head -20
  exit 1
fi

echo "✅ replyTokenを取得しました:"
echo "   $REPLY_TOKEN"
echo ""

echo "📤 ステップ3: reply APIを呼び出し（検証）"
echo ""

# LINEチャネルアクセストークンを取得
TOKEN=$(gcloud secrets versions access latest --secret=LINE_CHANNEL_ACCESS_TOKEN --project=aikaapp-584fa 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo "❌ LINEチャネルアクセストークンが取得できませんでした"
  exit 1
fi

# reply APIを呼び出し
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST 'https://api.line.me/v2/bot/message/reply' \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d "{
    \"replyToken\": \"${REPLY_TOKEN}\",
    \"messages\": [
      {
        \"type\": \"text\",
        \"text\": \"replyToken検証: このメッセージが届けば成功です！\"
      }
    ]
  }" 2>&1)

HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_CODE:/d')

echo ""
if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ reply API成功: HTTP $HTTP_CODE"
  echo "   レスポンス: $BODY"
  echo ""
  echo "🎉 検証完了！LINEアプリでメッセージが届いているか確認してください。"
else
  echo "❌ reply APIエラー: HTTP $HTTP_CODE"
  echo "   レスポンス: $BODY"
  echo ""
  echo "💡 ヒント:"
  echo "   - replyTokenが古い可能性があります。新しいメッセージを送信してください。"
  echo "   - 同じreplyTokenを2回以上使用していませんか？"
fi
