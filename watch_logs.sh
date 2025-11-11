#!/bin/bash
# リアルタイムログ監視スクリプト（最終テスト用）

echo "=== 最終テスト - リアルタイムログ監視 ==="
echo ""
echo "📱 テスト動画を送信後、このスクリプトを実行してください"
echo "⏱️  10秒ごとに最新のログを表示します（Ctrl+Cで停止）"
echo ""

while true; do
  clear
  echo "=== $(date '+%Y-%m-%d %H:%M:%S') ==="
  echo ""
  
  echo "【証②】processVideoJobのログ（最新5件）:"
  gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="processvideojob" AND (textPayload=~"processVideoJob開始" OR textPayload=~"processVideoJob成功" OR textPayload=~"LINE Webhookリクエスト")' \
    --limit=5 \
    --format="table(timestamp,severity,textPayload)" \
    --project=aikaapp-584fa \
    --freshness=5m 2>/dev/null || echo "  ログが見つかりません"
  
  echo ""
  echo "【全体ログ】最新10件:"
  gcloud logging read 'resource.type="cloud_run_revision" AND (resource.labels.service_name="processvideojob" OR resource.labels.service_name="linewebhookrouter")' \
    --limit=10 \
    --format="table(timestamp,severity,resource.labels.service_name,textPayload)" \
    --project=aikaapp-584fa \
    --freshness=5m 2>/dev/null | head -15 || echo "  ログが見つかりません"
  
  echo ""
  echo "【エラーログ】最新5件:"
  gcloud logging read 'severity>=ERROR AND (resource.labels.service_name="processvideojob" OR resource.labels.service_name="linewebhookrouter")' \
    --limit=5 \
    --format="table(timestamp,severity,textPayload)" \
    --project=aikaapp-584fa \
    --freshness=5m 2>/dev/null || echo "  エラーなし ✅"
  
  echo ""
  echo "⏱️  10秒後に更新します... (Ctrl+Cで停止)"
  sleep 10
done
