#!/bin/bash
# 認証ステータス確認スクリプト

PROJECT_ID="aikaapp-584fa"
SERVICE_NAME="process-video-trigger"
REGION="us-central1"

# 最新リビジョンを動的に取得
REVISION_NAME=$(gcloud run services describe $SERVICE_NAME --region=$REGION --project=$PROJECT_ID --format="value(status.latestReadyRevisionName)" 2>/dev/null)

if [ -z "$REVISION_NAME" ]; then
    echo "❌ 最新リビジョンを取得できませんでした"
    exit 1
fi

echo "🔍 認証ステータス確認中..."
echo "📋 リビジョン: $REVISION_NAME"
echo ""

echo "=== アプリケーション起動ログ ==="
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME AND resource.labels.revision_name=$REVISION_NAME AND (textPayload=~\"Booting\" OR textPayload=~\"Listening\" OR textPayload=~\"app\" OR textPayload=~\"Failed\")" --limit=10 --format=json --project=$PROJECT_ID --freshness=10m | jq -r '.[] | "\(.timestamp) | \(.textPayload // .jsonPayload.message // "")"'

echo ""
echo "=== 診断ログ ==="
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME AND resource.labels.revision_name=$REVISION_NAME AND (textPayload=~\"診断\" OR textPayload=~\"APIキー\" OR textPayload=~\"Authorization\" OR textPayload=~\"DIFY_API_KEY\")" --limit=10 --format=json --project=$PROJECT_ID --freshness=10m | jq -r '.[] | "\(.timestamp) | \(.textPayload // .jsonPayload.message // "")"'

echo ""
echo "=== Dify API呼び出し結果 ==="
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME AND resource.labels.revision_name=$REVISION_NAME AND (textPayload=~\"Dify\" OR textPayload=~\"401\" OR textPayload=~\"200\" OR textPayload=~\"成功\" OR textPayload=~\"エラー\")" --limit=10 --format=json --project=$PROJECT_ID --freshness=10m | jq -r '.[] | "\(.timestamp) | \(.severity) | \(.textPayload // .jsonPayload.message // "")"'
