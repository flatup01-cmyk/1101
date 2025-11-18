#!/bin/bash
# 最新リビジョンのリアルタイムログ監視

PROJECT_ID="aikaapp-584fa"
SERVICE_NAME="process-video-trigger"
REGION="us-central1"

# 最新リビジョンを動的に取得
REVISION_NAME=$(gcloud run services describe $SERVICE_NAME --region=$REGION --project=$PROJECT_ID --format="value(status.latestReadyRevisionName)" 2>/dev/null)

if [ -z "$REVISION_NAME" ]; then
    echo "❌ 最新リビジョンを取得できませんでした"
    exit 1
fi

echo "👀 最新リビジョンのリアルタイムログ監視開始"
echo "📋 リビジョン: $REVISION_NAME"
echo "🔍 認証関連ログをフィルタリング中..."
echo "（Ctrl+Cで終了）"
echo ""

gcloud logging tail "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME AND resource.labels.revision_name=$REVISION_NAME" --project=$PROJECT_ID --format="table(timestamp,severity,textPayload)" | grep -E "APIキー|Dify|401|診断|Authorization|asciiOnly|環境変数|prod|200|成功|エラー|ERROR|WARNING"
