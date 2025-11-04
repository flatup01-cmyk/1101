#!/bin/bash
# 🔍 手動確認項目の自動チェックスクリプト（簡易版）

set -e

echo "=========================================="
echo "🔍 手動確認項目の自動チェック"
echo "=========================================="
echo ""

# ============================================
# Firebase匿名認証の確認
# ============================================
echo "📋 チェック1: Firebase匿名認証の設定確認"
echo "----------------------------------------"
echo ""

# Identity Toolkit APIが有効か確認（匿名認証の前提条件）
if gcloud services list --enabled --project=aikaapp-584fa --filter="name:identitytoolkit.googleapis.com" --format="value(name)" 2>&1 | grep -q "identitytoolkit"; then
    echo "✅ Identity Toolkit APIが有効です（匿名認証の有効化が可能です）"
    echo ""
    echo "📝 次のステップ:"
    echo "   1. 以下のURLにアクセス:"
    echo "      https://console.firebase.google.com/project/aikaapp-584fa/authentication/providers"
    echo ""
    echo "   2. 「匿名」を探して、状態を確認"
    echo "   3. 無効の場合は「有効にする」をクリック"
    echo ""
    echo "   確認方法:"
    echo "   - 状態が「有効」になっていれば完了 ✅"
    echo "   - または、以下で動作確認:"
    echo "     https://aika18.netlify.app?dev=true"
    echo "     ブラウザのConsoleでエラーがないか確認"
else
    echo "❌ Identity Toolkit APIが無効です"
    echo "   先にAPIを有効化してください:"
    echo "   https://console.cloud.google.com/apis/library/identitytoolkit.googleapis.com?project=aikaapp-584fa"
fi
echo ""

# ============================================
# Netlify環境変数の確認
# ============================================
echo "📋 チェック2: Netlify環境変数の確認"
echo "----------------------------------------"
echo ""

echo "📝 確認手順:"
echo ""
echo "   方法1: Netlify Dashboardで確認（推奨）"
echo "   1. https://app.netlify.com/ にアクセス"
echo "   2. サイト「aika18」を選択"
echo "   3. Site settings → Environment variables"
echo "   4. 以下の環境変数が設定されているか確認:"
echo ""

REQUIRED_ENV_VARS=(
    "VITE_LIFF_ID"
    "VITE_FIREBASE_API_KEY"
    "VITE_FIREBASE_AUTH_DOMAIN"
    "VITE_FIREBASE_PROJECT_ID"
    "VITE_FIREBASE_STORAGE_BUCKET"
    "VITE_FIREBASE_MESSAGING_SENDER_ID"
    "VITE_FIREBASE_APP_ID"
)

for var in "${REQUIRED_ENV_VARS[@]}"; do
    echo "      - $var"
done
echo ""

echo "   方法2: 実際のアプリで確認"
echo "   1. https://aika18.netlify.app?dev=true にアクセス"
echo "   2. ブラウザの開発者ツール（F12）を開く"
echo "   3. Consoleタブで以下を実行:"
echo ""
echo "      console.log('環境変数チェック:');"
echo "      console.log('LIFF_ID:', import.meta.env.VITE_LIFF_ID ? '✅' : '❌');"
echo "      console.log('FIREBASE_API_KEY:', import.meta.env.VITE_FIREBASE_API_KEY ? '✅' : '❌');"
echo "      console.log('FIREBASE_AUTH_DOMAIN:', import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ? '✅' : '❌');"
echo "      console.log('FIREBASE_PROJECT_ID:', import.meta.env.VITE_FIREBASE_PROJECT_ID ? '✅' : '❌');"
echo "      console.log('FIREBASE_STORAGE_BUCKET:', import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ? '✅' : '❌');"
echo "      console.log('FIREBASE_MESSAGING_SENDER_ID:', import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ? '✅' : '❌');"
echo "      console.log('FIREBASE_APP_ID:', import.meta.env.VITE_FIREBASE_APP_ID ? '✅' : '❌');"
echo ""

echo "=========================================="
echo "📋 クイック確認URL"
echo "=========================================="
echo ""
echo "🔐 Firebase匿名認証:"
echo "   https://console.firebase.google.com/project/aikaapp-584fa/authentication/providers"
echo ""
echo "🌐 Netlify環境変数:"
echo "   https://app.netlify.com/"
echo ""
echo "🧪 動作確認:"
echo "   https://aika18.netlify.app?dev=true"
echo ""

echo "=========================================="
echo "✅ 確認手順完了"
echo "=========================================="
echo ""
echo "💡 ヒント:"
echo "   - すべての確認は約5分で完了します"
echo "   - Firebase ConsoleとNetlify Dashboardを開いて確認するだけです"
echo "   - 動作確認は実際のアプリで確認できます"
echo ""
