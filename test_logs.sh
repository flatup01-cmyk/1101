#!/bin/bash
# 最終テスト用ログ確認スクリプト

echo "=== 最終テスト - ログ確認 ==="
echo ""
echo "📱 テスト動画を送信後、このスクリプトを実行してください"
echo ""

# processVideoJobのログを確認
echo "【証②】processVideoJobのログ確認:"
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="processvideojob" AND (textPayload=~"processVideoJob開始" OR textPayload=~"processVideoJob成功" OR textPayload=~"LINE Webhookリクエスト")' \
  --limit=10 \
  --format="table(timestamp,severity,textPayload)" \
  --project=aikaapp-584fa \
  --freshness=10m

echo ""
echo "【全体ログ】最新20件:"
gcloud logging read 'resource.type="cloud_run_revision" AND (resource.labels.service_name="processvideojob" OR resource.labels.service_name="linewebhookrouter")' \
  --limit=20 \
  --format="table(timestamp,severity,resource.labels.service_name,textPayload)" \
  --project=aikaapp-584fa \
  --freshness=10m

echo ""
echo "【エラーログ】最新10件:"
gcloud logging read 'severity>=ERROR AND (resource.labels.service_name="processvideojob" OR resource.labels.service_name="linewebhookrouter")' \
  --limit=10 \
  --format="table(timestamp,severity,textPayload)" \
  --project=aikaapp-584fa \
  --freshness=10m

echo ""
echo "✅ ログ確認完了"
