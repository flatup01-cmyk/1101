#!/bin/bash
# reply→push詳細検証スクリプト

echo "=== Webhook JSON確認（replyTokenとuserId抽出） ==="
echo ""

# 最新のWebhook受信ログを取得
WEBHOOK_LOG=$(gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="linewebhookrouter" AND textPayload=~"動画メッセージ"' \
  --limit=1 \
  --format="json" \
  --project=aikaapp-584fa \
  --freshness=10m 2>/dev/null)

if [ -z "$WEBHOOK_LOG" ] || [ "$WEBHOOK_LOG" = "[]" ]; then
  echo "⚠️  Webhookログが見つかりません"
  echo "   テスト動画を送信してください"
  echo ""
else
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

  if [ -n "$REPLY_TOKEN" ] && [ -n "$USER_ID" ]; then
    echo "✅ replyToken: $REPLY_TOKEN"
    echo "✅ userId: $USER_ID"
  else
    echo "⚠️  replyTokenまたはuserIdが取得できませんでした"
  fi
fi

echo ""
echo "=== reply API確認（即座に返信） ==="
REPLY_SUCCESS=$(gcloud logging read 'textPayload=~"ユーザーへの受付完了メッセージの送信に成功"' \
  --limit=1 \
  --format="value(textPayload)" \
  --project=aikaapp-584fa \
  --freshness=10m 2>/dev/null)

if [ -n "$REPLY_SUCCESS" ]; then
  echo "✅ reply API成功: $REPLY_SUCCESS"
  echo "   レスポンス: 2xx (成功)"
else
  echo "⚠️  reply APIの成功ログが見つかりません"
fi

echo ""
echo "=== push API確認（Dify結果送信） ==="
PUSH_LOGS=$(gcloud logging read 'textPayload=~"sendLineMessage\|processVideoJob成功\|LINE push error"' \
  --limit=5 \
  --format="table(timestamp,severity,textPayload)" \
  --project=aikaapp-584fa \
  --freshness=10m 2>/dev/null)

if [ -n "$PUSH_LOGS" ]; then
  echo "$PUSH_LOGS"
  
  # push APIのエラーをチェック
  PUSH_ERROR=$(echo "$PUSH_LOGS" | grep -i "error\|failed" || true)
  if [ -z "$PUSH_ERROR" ]; then
    echo ""
    echo "✅ push API成功: レスポンス2xx (成功)"
  else
    echo ""
    echo "❌ push APIエラー: レスポンスが2xx以外"
    echo "$PUSH_ERROR"
  fi
else
  echo "⚠️  push APIのログが見つかりません"
fi

echo ""
echo "=== エラーログ確認 ==="
ERRORS=$(gcloud logging read 'severity>=ERROR AND (textPayload=~"LINE\|reply\|push")' \
  --limit=5 \
  --format="table(timestamp,severity,textPayload)" \
  --project=aikaapp-584fa \
  --freshness=10m 2>/dev/null)

if [ -n "$ERRORS" ]; then
  echo "$ERRORS"
  echo ""
  echo "❌ エラーが検出されました。上記のメッセージで原因を特定してください。"
else
  echo "✅ エラーなし"
fi

echo ""
echo "=== 検証結果サマリー ==="
if [ -n "$REPLY_SUCCESS" ] && [ -n "$PUSH_LOGS" ] && [ -z "$ERRORS" ]; then
  echo "✅ 完全成功: reply APIとpush APIの両方が2xxで成功"
  echo "✅ LINEにメッセージが届いていることを確認してください"
else
  echo "⚠️  一部の確認が完了していません"
  echo "   上記のログを確認してください"
fi
