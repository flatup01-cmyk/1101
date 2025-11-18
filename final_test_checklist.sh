#!/bin/bash
# 最終テストチェックリスト

echo "🧪 最終テストチェックリスト"
echo ""
echo "✅ 1. Secret Manager確認"
gcloud secrets versions list DIFY_API_KEY --project=aikaapp-584fa --format='table(name,state,createTime,aliases)' --limit=5
echo ""
echo "✅ 2. Cloud Run設定確認"
gcloud run services describe process-video-trigger --region=us-central1 --project=aikaapp-584fa --format="json" | jq -r '.spec.template.spec.containers[0].env[] | select(.name=="DIFY_API_KEY") | .valueFrom.secretKeyRef'
echo ""
echo "✅ 3. 最新リビジョン確認"
gcloud run services describe process-video-trigger --region=us-central1 --project=aikaapp-584fa --format="value(status.latestReadyRevisionName)"
echo ""
echo "📊 テスト手順:"
echo "1. 動画をアップロード"
echo "2. ログ確認: ./check_auth_status.sh"
echo "3. 期待されるログ:"
echo "   ✅ 🔑 APIキー検証: 長さ=XX, 先頭10文字=app***XX..."
echo "   ✅ ✅ APIキーサニタイズ成功: 長さ=XX"
echo "   ✅ 🔍 [診断] Authorizationヘッダー検査: len=XX, asciiOnly=true"
echo "   ✅ ✅ Dify API呼び出し成功: status=200"
