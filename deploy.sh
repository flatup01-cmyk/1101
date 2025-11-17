#!/bin/bash
# Cloud Runデプロイスクリプト

set -e  # エラーが発生したら終了

echo "🚀 Cloud Runデプロイ開始..."

# プロジェクト設定
PROJECT_ID="aikaapp-584fa"
REGION="us-central1"
SERVICE_NAME="process-video-trigger"

# 現在のディレクトリを確認
cd /Users/jin/new-kingdom

echo "📋 プロジェクト: $PROJECT_ID"
echo "📋 リージョン: $REGION"
echo "📋 サービス名: $SERVICE_NAME"

# Cloud Runにデプロイ
echo "📦 Cloud Runにデプロイ中..."
gcloud run deploy $SERVICE_NAME \
  --source=./functions \
  --region=$REGION \
  --platform=managed \
  --allow-unauthenticated \
  --memory=2Gi \
  --timeout=540s \
  --max-instances=10 \
  --update-secrets DIFY_API_KEY=DIFY_API_KEY:prod \
  --set-env-vars DIFY_API_ENDPOINT=https://api.dify.ai/v1/chat-messages \
  --project=$PROJECT_ID

echo "✅ デプロイ完了！"

# サービス情報を表示
echo "📊 サービス情報:"
gcloud run services describe $SERVICE_NAME \
  --region=$REGION \
  --project=$PROJECT_ID \
  --format="value(status.url)"

echo ""
echo "🔍 ログを確認:"
echo "gcloud logging read \"resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME\" --limit=50 --project=$PROJECT_ID"
