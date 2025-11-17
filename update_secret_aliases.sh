#!/bin/bash
# Secret Managerエイリアス設定ガイド

PROJECT_ID="aikaapp-584fa"

echo "🔧 Secret Managerエイリアス設定ガイド"
echo ""

# 最新バージョンを確認
echo "📋 最新バージョン確認中..."

# DIFY_API_KEY
LATEST_VERSION=$(gcloud secrets versions list DIFY_API_KEY --project=$PROJECT_ID --format="value(name)" --limit=1 --sort-by=~createTime | head -1)
if [ -n "$LATEST_VERSION" ]; then
    VERSION_NUM=$(echo $LATEST_VERSION | awk -F'/' '{print $NF}')
    echo "✅ DIFY_API_KEY 最新バージョン: $VERSION_NUM"
    echo "   エイリアス設定コマンド（Google Cloud Consoleから実行）:"
    echo "   https://console.cloud.google.com/security/secret-manager/secret/DIFY_API_KEY/versions/$VERSION_NUM?project=$PROJECT_ID"
    echo "   → 「エイリアスを追加」→ エイリアス名: prod"
else
    echo "❌ DIFY_API_KEYの最新バージョンが見つかりません"
fi

echo ""

# LINE_CHANNEL_ACCESS_TOKEN
LATEST_VERSION=$(gcloud secrets versions list LINE_CHANNEL_ACCESS_TOKEN --project=$PROJECT_ID --format="value(name)" --limit=1 --sort-by=~createTime | head -1)
if [ -n "$LATEST_VERSION" ]; then
    VERSION_NUM=$(echo $LATEST_VERSION | awk -F'/' '{print $NF}')
    echo "✅ LINE_CHANNEL_ACCESS_TOKEN 最新バージョン: $VERSION_NUM"
    echo "   エイリアス設定コマンド（Google Cloud Consoleから実行）:"
    echo "   https://console.cloud.google.com/security/secret-manager/secret/LINE_CHANNEL_ACCESS_TOKEN/versions/$VERSION_NUM?project=$PROJECT_ID"
    echo "   → 「エイリアスを追加」→ エイリアス名: prod"
else
    echo "❌ LINE_CHANNEL_ACCESS_TOKENの最新バージョンが見つかりません"
fi

echo ""
echo "📋 または、Secret Manager APIを使用してエイリアスを設定:"
echo "   gcloud alpha secrets versions add-version-alias prod <VERSION_NUM> --secret=<SECRET_NAME> --project=$PROJECT_ID"
echo ""
echo "📋 エイリアス確認コマンド:"
echo "   gcloud secrets versions list DIFY_API_KEY --project=$PROJECT_ID --format='table(name,aliases)'"
echo "   gcloud secrets versions list LINE_CHANNEL_ACCESS_TOKEN --project=$PROJECT_ID --format='table(name,aliases)'"
