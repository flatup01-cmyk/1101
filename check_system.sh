#!/bin/bash
# 🔍 AIKA Battle Scouter システム全体チェックスクリプト（完全版）
# 100%実行可能なチェックリスト

set -e

PROJECT_ID="aikaapp-584fa"
FUNCTION_NAME="process_video_trigger"
REGION="us-central1"
BUCKET="aikaapp-584fa.firebasestorage.app"

# カラー出力
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "🔍 AIKA Battle Scouter システムチェック"
echo "=========================================="
echo ""

# 結果を保存する配列
CHECKS_PASSED=()
CHECKS_FAILED=()
CHECKS_WARNING=()
CHECKS_INFO=()

# チェック関数
check_pass() {
    echo -e "${GREEN}✅ $1${NC}"
    CHECKS_PASSED+=("$1")
}

check_fail() {
    echo -e "${RED}❌ $1${NC}"
    CHECKS_FAILED+=("$1")
}

check_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
    CHECKS_WARNING+=("$1")
}

check_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
    CHECKS_INFO+=("$1")
}

# ============================================
# チェック1: Cloud Functionsのデプロイ状態
# ============================================
echo "📋 チェック1: Cloud Functionsのデプロイ状態"
echo "----------------------------------------"
if firebase functions:list 2>&1 | grep -q "$FUNCTION_NAME"; then
    FUNC_INFO=$(firebase functions:list 2>&1 | grep "$FUNCTION_NAME")
    check_pass "Cloud Functionsがデプロイ済み: $FUNCTION_NAME"
    echo "   詳細: $FUNC_INFO"
else
    check_fail "Cloud Functionsがデプロイされていません"
fi
echo ""

# ============================================
# チェック2: Storageトリガーの設定
# ============================================
echo "📋 チェック2: Storageトリガーの設定"
echo "----------------------------------------"
TRIGGER_INFO=$(gcloud functions describe $FUNCTION_NAME --gen2 --region=$REGION --format="value(eventTrigger)" 2>&1 || echo "ERROR")
if echo "$TRIGGER_INFO" | grep -q "$BUCKET"; then
    EVENT_TYPE=$(echo "$TRIGGER_INFO" | grep -o 'eventType=[^;]*' | cut -d= -f2 || echo "unknown")
    check_pass "Storageトリガーが正しく設定されています"
    echo "   バケット: $BUCKET"
    echo "   イベントタイプ: $EVENT_TYPE"
else
    check_fail "Storageトリガーが正しく設定されていません"
fi
echo ""

# ============================================
# チェック3: Firestoreルールのデプロイ
# ============================================
echo "📋 チェック3: Firestoreルールのデプロイ"
echo "----------------------------------------"
if firebase deploy --only firestore --dry-run 2>&1 | grep -q "rules file firestore.rules compiled successfully"; then
    check_pass "Firestoreルールがコンパイル可能です"
else
    check_warning "Firestoreルールの確認が必要です"
fi
echo ""

# ============================================
# チェック4: Storageルールのデプロイ
# ============================================
echo "📋 チェック4: Storageルールのデプロイ"
echo "----------------------------------------"
if firebase deploy --only storage --dry-run 2>&1 | grep -q "rules file storage.rules compiled successfully"; then
    check_pass "Storageルールがコンパイル可能です"
else
    check_warning "Storageルールの確認が必要です"
fi
echo ""

# ============================================
# チェック5: Cloud Functions環境変数
# ============================================
echo "📋 チェック5: Cloud Functions環境変数"
echo "----------------------------------------"
ENV_VARS=$(gcloud functions describe $FUNCTION_NAME --gen2 --region=$REGION --format="get(serviceConfig.environmentVariables)" 2>&1 || echo "")
if echo "$ENV_VARS" | grep -q "DIFY_API_ENDPOINT"; then
    DIFY_ENDPOINT=$(echo "$ENV_VARS" | grep -o 'DIFY_API_ENDPOINT=[^;]*' | cut -d= -f2 || echo "")
    check_pass "DIFY_API_ENDPOINTが設定されています"
    echo "   値: $DIFY_ENDPOINT"
else
    check_fail "DIFY_API_ENDPOINTが設定されていません"
fi

if echo "$ENV_VARS" | grep -q "DIFY_API_KEY"; then
    DIFY_KEY=$(echo "$ENV_VARS" | grep -o 'DIFY_API_KEY=[^;]*' | cut -d= -f2 || echo "")
    check_pass "DIFY_API_KEYが設定されています"
    echo "   値: ${DIFY_KEY:0:20}... (マスク済み)"
else
    check_fail "DIFY_API_KEYが設定されていません"
fi
echo ""

# ============================================
# チェック6: Secret Manager設定
# ============================================
echo "📋 チェック6: Secret Manager設定"
echo "----------------------------------------"
if gcloud secrets list --project=$PROJECT_ID --filter="name:LINE_CHANNEL_ACCESS_TOKEN" --format="value(name)" 2>&1 | grep -q "LINE_CHANNEL_ACCESS_TOKEN"; then
    SECRET_CREATED=$(gcloud secrets describe LINE_CHANNEL_ACCESS_TOKEN --project=$PROJECT_ID --format="value(createTime)" 2>&1 || echo "")
    check_pass "LINE_CHANNEL_ACCESS_TOKENがSecret Managerに存在します"
    if [ -n "$SECRET_CREATED" ]; then
        echo "   作成日時: $SECRET_CREATED"
    fi
else
    check_fail "LINE_CHANNEL_ACCESS_TOKENがSecret Managerに存在しません"
fi
echo ""

# ============================================
# チェック7: Identity Toolkit API
# ============================================
echo "📋 チェック7: Identity Toolkit API"
echo "----------------------------------------"
if gcloud services list --enabled --project=$PROJECT_ID --filter="name:identitytoolkit.googleapis.com" --format="value(name)" 2>&1 | grep -q "identitytoolkit"; then
    check_pass "Identity Toolkit APIが有効です"
else
    check_warning "Identity Toolkit APIが有効か確認が必要です"
    echo "   有効化URL: https://console.cloud.google.com/apis/library/identitytoolkit.googleapis.com?project=$PROJECT_ID"
fi
echo ""

# ============================================
# チェック8: Firebase匿名認証設定（API確認）
# ============================================
echo "📋 チェック8: Firebase匿名認証設定"
echo "----------------------------------------"
# Firebase REST APIを使用して匿名認証の状態を確認
# 注意: Firebase Admin APIを使用する必要がありますが、現在の環境では直接確認が難しいため、
# Identity Toolkit APIが有効であれば匿名認証も有効化可能と判断
if gcloud services list --enabled --project=$PROJECT_ID --filter="name:identitytoolkit.googleapis.com" --format="value(name)" 2>&1 | grep -q "identitytoolkit"; then
    check_info "Identity Toolkit APIが有効です（匿名認証の有効化が可能です）"
    echo "   確認URL: https://console.firebase.google.com/project/$PROJECT_ID/authentication/providers"
    echo "   手順:"
    echo "   1. 上記URLにアクセス"
    echo "   2. 「匿名」を探す"
    echo "   3. 「有効にする」をクリック（まだ有効でない場合）"
    check_warning "Firebase匿名認証が有効化されているか手動確認してください"
else
    check_fail "Identity Toolkit APIが無効です。先にAPIを有効化してください"
fi
echo ""

# ============================================
# チェック9: Netlify環境変数（確認方法を提供）
# ============================================
echo "📋 チェック9: Netlify環境変数"
echo "----------------------------------------"
echo "   確認方法:"
echo "   1. Netlify Dashboardにアクセス: https://app.netlify.com/"
echo "   2. サイトを選択: aika18"
echo "   3. Site settings → Environment variables"
echo "   4. 以下の環境変数が設定されているか確認:"
echo ""
echo "   必要な環境変数:"
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
    echo "   - $var"
done
echo ""
check_info "Netlify環境変数はNetlify Dashboardで確認してください"
check_warning "すべての環境変数が設定されているか確認してください"
echo ""

# ============================================
# チェック10: コードファイルの存在確認
# ============================================
echo "📋 チェック10: コードファイルの存在確認"
echo "----------------------------------------"
FILES=(
    "src/main.js"
    "src/firebase.js"
    "src/config.js"
    "functions/main.py"
    "functions/analyze.py"
    "functions/rate_limiter.py"
    "firestore.rules"
    "storage.rules"
    "firebase.json"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        check_pass "ファイルが存在します: $file"
    else
        check_fail "ファイルが存在しません: $file"
    fi
done
echo ""

# ============================================
# チェック11: MCP連携の実装確認
# ============================================
echo "📋 チェック11: MCP連携の実装確認"
echo "----------------------------------------"
if grep -q "call_dify_via_mcp" functions/main.py; then
    check_pass "MCP連携関数が実装されています: call_dify_via_mcp()"
else
    check_fail "MCP連携関数が実装されていません"
fi

if grep -q "DIFY_API_ENDPOINT" functions/main.py && grep -q "DIFY_API_KEY" functions/main.py; then
    check_pass "Dify API設定がコードに含まれています"
else
    check_fail "Dify API設定がコードに含まれていません"
fi
echo ""

# ============================================
# チェック結果サマリー
# ============================================
echo "=========================================="
echo "📊 チェック結果サマリー"
echo "=========================================="
echo ""
echo -e "${GREEN}✅ 成功: ${#CHECKS_PASSED[@]}件${NC}"
echo -e "${RED}❌ 失敗: ${#CHECKS_FAILED[@]}件${NC}"
echo -e "${YELLOW}⚠️  警告: ${#CHECKS_WARNING[@]}件${NC}"
echo -e "${YELLOW}ℹ️  情報: ${#CHECKS_INFO[@]}件${NC}"
echo ""

# 詳細レポート
if [ ${#CHECKS_FAILED[@]} -gt 0 ]; then
    echo "❌ 失敗した項目:"
    for fail in "${CHECKS_FAILED[@]}"; do
        echo "   - $fail"
    done
    echo ""
fi

if [ ${#CHECKS_WARNING[@]} -gt 0 ]; then
    echo "⚠️  警告項目（手動確認推奨）:"
    for warning in "${CHECKS_WARNING[@]}"; do
        echo "   - $warning"
    done
    echo ""
fi

# 最終判定
if [ ${#CHECKS_FAILED[@]} -eq 0 ]; then
    echo -e "${GREEN}🎉 すべての自動チェックが成功しました！${NC}"
    echo ""
    if [ ${#CHECKS_WARNING[@]} -gt 0 ] || [ ${#CHECKS_INFO[@]} -gt 0 ]; then
        echo "📝 次のステップ:"
        echo "   1. Firebase匿名認証の有効化を確認"
        echo "       URL: https://console.firebase.google.com/project/$PROJECT_ID/authentication/providers"
        echo ""
        echo "   2. Netlify環境変数の設定を確認"
        echo "       URL: https://app.netlify.com/"
        echo ""
        echo "   3. 動作確認"
        echo "       - LIFFアプリで動画をアップロード"
        echo "       - Firebase Consoleでログを確認"
        echo "       - LINEでメッセージが届くことを確認"
    fi
    echo ""
    exit 0
else
    echo -e "${RED}❌ 一部のチェックが失敗しました。上記の失敗項目を確認してください。${NC}"
    echo ""
    exit 1
fi

echo ""
echo "=========================================="
echo "✅ チェック完了"
echo "=========================================="
