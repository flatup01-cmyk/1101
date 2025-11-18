#!/bin/bash
# prodエイリアス設定確認スクリプト

PROJECT_ID="aikaapp-584fa"

echo "🔍 prodエイリアス設定確認中..."
echo ""

# バージョン10のエイリアスを直接確認
ALIASES=$(gcloud secrets versions describe 10 --secret=DIFY_API_KEY --project=$PROJECT_ID --format=json 2>/dev/null | jq -r '.aliases // [] | join(",")')

echo "📋 バージョン一覧:"
gcloud secrets versions list DIFY_API_KEY --project=$PROJECT_ID --format='table(name,state,createTime)' --limit=5
echo ""

if [ -n "$ALIASES" ] && echo "$ALIASES" | grep -q "prod"; then
    echo "✅ 成功: バージョン10にprodエイリアスが設定されています"
    echo "   📌 エイリアス: $ALIASES"
    echo ""
    echo "📊 Cloud Run設定確認:"
    CLOUD_RUN_CONFIG=$(gcloud run services describe process-video-trigger --region=us-central1 --project=$PROJECT_ID --format="json" 2>/dev/null | jq -r '.spec.template.spec.containers[0].env[] | select(.name=="DIFY_API_KEY") | .valueFrom.secretKeyRef')
    echo "$CLOUD_RUN_CONFIG"
    echo ""
    
    if echo "$CLOUD_RUN_CONFIG" | grep -q '"key": "prod"'; then
        echo "✅ Cloud Runはprodエイリアスを正しく参照しています"
        echo ""
        echo "🧪 最終テスト準備完了:"
        echo "1. 動画をアップロード"
        echo "2. ログ確認: ./check_auth_status.sh"
    else
        echo "⚠️ Cloud Runの設定を確認してください"
    fi
else
    echo "⚠️ バージョン10にprodエイリアスが設定されていません"
    echo "   （現在のエイリアス: ${ALIASES:-なし}）"
    echo ""
    echo "🔧 Google Cloud Consoleで設定してください:"
    echo "https://console.cloud.google.com/security/secret-manager/secret/DIFY_API_KEY/versions/10?project=$PROJECT_ID"
fi
