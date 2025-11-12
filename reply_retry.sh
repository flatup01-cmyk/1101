#!/bin/bash
# reply API再試行スクリプト（最新のreplyTokenを使用）

echo "=== reply API再試行 ==="
echo ""

# 最新のWebhookイベントからreplyTokenとuserIdを取得
WEBHOOK_LOG=$(gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="linewebhookrouter" AND textPayload=~"動画メッセージ"' \
  --limit=1 \
  --format="json" \
  --project=aikaapp-584fa \
  --freshness=10m 2>/dev/null)

if [ -z "$WEBHOOK_LOG" ] || [ "$WEBHOOK_LOG" = "[]" ]; then
  echo "❌ 最新のWebhookログが見つかりません"
  echo "   テスト動画を送信してください"
  exit 1
fi

# replyTokenとuserIdを抽出
REPLY_TOKEN=$(echo "$WEBHOOK_LOG" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    if data and len(data) > 0:
        text = data[0].get('textPayload', '')
        if text:
            import json as j
            try:
                body = j.loads(text)
                if 'events' in body and len(body['events']) > 0:
                    print(body['events'][0].get('replyToken', ''))
            except:
                pass
except:
    pass
" 2>/dev/null)

USER_ID=$(echo "$WEBHOOK_LOG" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    if data and len(data) > 0:
        text = data[0].get('textPayload', '')
        if text:
            import json as j
            try:
                body = j.loads(text)
                if 'events' in body and len(body['events']) > 0:
                    print(body['events'][0].get('source', {}).get('userId', ''))
            except:
                pass
except:
    pass
" 2>/dev/null)

if [ -z "$REPLY_TOKEN" ] || [ -z "$USER_ID" ]; then
  echo "❌ replyTokenまたはuserIdが取得できませんでした"
  exit 1
fi

echo "✅ replyToken: $REPLY_TOKEN"
echo "✅ userId: $USER_ID"
echo ""

# LINEチャネルアクセストークンを取得
TOKEN=$(gcloud secrets versions access latest --secret=LINE_CHANNEL_ACCESS_TOKEN --project=aikaapp-584fa 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo "❌ LINEチャネルアクセストークンが取得できませんでした"
  exit 1
fi

# reply APIを呼び出し
echo "📤 reply APIを呼び出し中..."
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST 'https://api.line.me/v2/bot/message/reply' \
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
  }" 2>&1)

HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_CODE:/d')

echo ""
if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ reply API成功: HTTP $HTTP_CODE"
  echo "   レスポンス: $BODY"
else
  echo "❌ reply APIエラー: HTTP $HTTP_CODE"
  echo "   レスポンス: $BODY"
  echo ""
  echo "💡 ヒント:"
  echo "   - Invalid reply token は古い/再利用/受信から時間経過が原因です"
  echo "   - 必ず「最新のWebhookイベントのreplyToken」を即時使用してください"
  echo "   - 新しい動画を送信して、最新のreplyTokenを取得してください"
fi
