#!/bin/bash
# reply→push検証スクリプト

echo "=== Webhook JSON確認 ==="
echo ""
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="linewebhookrouter" AND textPayload=~"動画メッセージ"' \
  --limit=1 \
  --format="json" \
  --project=aikaapp-584fa \
  --freshness=10m 2>/dev/null | \
  python3 -c "
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
                    event = body['events'][0]
                    print(f\"replyToken: {event.get('replyToken', 'N/A')}\")
                    print(f\"userId: {event.get('source', {}).get('userId', 'N/A')}\")
            except:
                print('JSON解析エラー')
        else:
            print('textPayloadが見つかりません')
    else:
        print('ログが見つかりません')
except:
    print('ログ取得エラー')
" 2>/dev/null || echo "  ログが見つかりません（テスト動画を送信してください）"

echo ""
echo "=== reply API確認 ==="
gcloud logging read 'textPayload=~"ユーザーへの受付完了メッセージの送信に成功"' \
  --limit=1 \
  --format="table(timestamp,severity,textPayload)" \
  --project=aikaapp-584fa \
  --freshness=10m 2>/dev/null || echo "  ログが見つかりません"

echo ""
echo "=== push API確認 ==="
gcloud logging read 'textPayload=~"sendLineMessage\|LINE push error\|processVideoJob成功"' \
  --limit=5 \
  --format="table(timestamp,severity,textPayload)" \
  --project=aikaapp-584fa \
  --freshness=10m 2>/dev/null || echo "  ログが見つかりません"

echo ""
echo "=== エラーログ確認 ==="
gcloud logging read 'severity>=ERROR AND (textPayload=~"LINE\|reply\|push")' \
  --limit=5 \
  --format="table(timestamp,severity,textPayload)" \
  --project=aikaapp-584fa \
  --freshness=10m 2>/dev/null || echo "  エラーなし ✅"

echo ""
echo "✅ 検証完了"
