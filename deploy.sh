#!/bin/bash
# AIKA18号 バトルスコープ デプロイスクリプト（最短最速版）

set -e

echo "=========================================="
echo "🚀 AIKA18号 バトルスコープ デプロイ開始"
echo "=========================================="

# プロジェクトルートに移動
cd "$(dirname "$0")"

# Firebase Storageルールをデプロイ
echo ""
echo "📋 Firebase Storageルールをデプロイ中..."
firebase deploy --only storage || {
    echo "⚠️ Storageルールのデプロイに失敗しました。続行します..."
}

# Firebase Functionsをデプロイ
echo ""
echo "📋 Firebase Functionsをデプロイ中..."
firebase deploy --only functions || {
    echo "⚠️ Functionsのデプロイに失敗しました。"
    echo "   代替方法: DEPLOY_WITH_GCLOUD.md を参照してください"
    exit 1
}

echo ""
echo "=========================================="
echo "✅ デプロイ完了！"
echo "=========================================="
echo ""
echo "次のステップ:"
echo "1. Firebase Consoleでログを確認"
echo "2. LIFFアプリで動画アップロードをテスト"
echo "3. LINEで通知が届くことを確認"

