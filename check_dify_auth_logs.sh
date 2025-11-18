#!/bin/bash
# Dify API認証ログ確認スクリプト

PROJECT_ID="aikaapp-584fa"
SERVICE_NAME="process-video-trigger"
REVISION_NAME="process-video-trigger-00016-9m5"

echo "🔍 Dify API認証ログを監視中..."
echo "📋 リビジョン: $REVISION_NAME"
echo ""

gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME AND resource.labels.revision_name=$REVISION_NAME AND (textPayload=~\"APIキー\" OR textPayload=~\"Dify\" OR textPayload=~\"401\" OR textPayload=~\"診断\" OR textPayload=~\"Authorization\" OR textPayload=~\"asciiOnly\")" --limit=50 --format=json --project=$PROJECT_ID --freshness=10m | jq -r '.[] | "\(.timestamp) | \(.severity) | \(.textPayload // .jsonPayload.message // "")"'
