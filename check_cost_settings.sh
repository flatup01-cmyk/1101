#!/bin/bash
# GCPコスト管理設定の確認スクリプト

echo "🔍 GCPコスト管理設定の確認を開始します..."
echo ""

# プロジェクトID
PROJECT_ID="aikaapp-584fa"

# 1. Cloud Schedulerジョブの確認
echo "📅 1. Cloud Schedulerジョブの確認"
echo "----------------------------------------"
gcloud scheduler jobs list --project=$PROJECT_ID --location=asia-northeast1 2>/dev/null | grep -i cleanup || echo "❌ cleanup-storage-daily ジョブが見つかりません"
echo ""

# 2. Cloud Functionsの確認
echo "⚙️  2. Cloud Functionsの確認"
echo "----------------------------------------"
gcloud functions list --project=$PROJECT_ID --region=asia-northeast1 2>/dev/null | grep -i cleanup || echo "❌ cleanup_storage_http 関数が見つかりません"
echo ""

# 3. 予算の確認
echo "💰 3. GCP予算の確認"
echo "----------------------------------------"
gcloud billing budgets list --billing-account=$(gcloud billing accounts list --format="value(name)" --limit=1) --project=$PROJECT_ID 2>/dev/null || echo "⚠️  予算が設定されていない可能性があります"
echo ""

# 4. Storage使用量の確認
echo "💾 4. Storage使用量の確認"
echo "----------------------------------------"
gsutil du -sh gs://aikaapp-584fa.firebasestorage.app/videos/ 2>/dev/null || echo "⚠️  Storage使用量を取得できませんでした"
echo ""

# 5. アラートポリシーの確認
echo "🚨 5. Cloud Monitoringアラートポリシーの確認"
echo "----------------------------------------"
gcloud monitoring alert-policies list --project=$PROJECT_ID --format="table(displayName,enabled)" 2>/dev/null | head -10 || echo "⚠️  アラートポリシーを取得できませんでした"
echo ""

echo "✅ 確認完了"
echo ""
echo "📋 次のステップ:"
echo "1. Cloud Schedulerジョブが存在しない場合: STORAGE_AUTO_CLEANUP_SETUP.md を参照"
echo "2. 予算が設定されていない場合: GCP_BILLING_ALERT.md を参照"
echo "3. アラートが設定されていない場合: GCP_BILLING_ALERT.md を参照"

