#!/bin/bash
# リアルタイムログ監視スクリプト

PROJECT_ID="aikaapp-584fa"
SERVICE_NAME="process-video-trigger"

echo "👀 リアルタイムログ監視開始（Ctrl+Cで終了）..."
echo "📋 サービス: $SERVICE_NAME"
echo ""

gcloud logging tail "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME" --project=$PROJECT_ID --format="table(timestamp,severity,textPayload)" | grep -E "APIキー|Dify|401|診断|Authorization|asciiOnly|環境変数|prod"
