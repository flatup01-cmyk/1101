#!/bin/bash
# システム修復プログラム
# 10年以上経験のあるエンジニアが国外大手企業で行うレベルのデバッグ観点を包括

set -e  # エラー時に停止
set -o pipefail  # パイプのエラーもキャッチ

# カラー出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ログファイル
LOG_DIR="./diagnostics-logs"
mkdir -p "$LOG_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="$LOG_DIR/diagnostics_${TIMESTAMP}.log"

log() {
    echo -e "$1" | tee -a "$LOG_FILE"
}

log_info() {
    log "${BLUE}[INFO]${NC} $1"
}

log_success() {
    log "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    log "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    log "${RED}[ERROR]${NC} $1"
}

log_section() {
    log "\n${BLUE}========================================${NC}"
    log "${BLUE}$1${NC}"
    log "${BLUE}========================================${NC}"
}

# ============================================
# 1. 前提の確立と環境の完全再現
# ============================================
log_section "1. 前提の確立と環境の完全再現"

# 1a. ブランチとコミットの固定
log_info "現在のブランチとコミットを記録..."
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
CURRENT_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
log_info "ブランチ: $CURRENT_BRANCH"
log_info "コミット: $CURRENT_COMMIT"

# 作業用ブランチ作成
FIX_BRANCH="fix/diagnostics-$(date +%Y%m%d_%H%M%S)"
log_info "作業用ブランチを作成: $FIX_BRANCH"
if git rev-parse --verify "$FIX_BRANCH" >/dev/null 2>&1; then
    log_warning "ブランチ $FIX_BRANCH は既に存在します"
else
    git checkout -b "$FIX_BRANCH" 2>/dev/null || log_warning "ブランチ作成スキップ（gitリポジトリでない可能性）"
fi

# 1b. Node.jsバージョンの確認
log_info "Node.jsバージョンを確認..."
NODE_VERSION=$(node --version 2>/dev/null || echo "not installed")
log_info "Node.js: $NODE_VERSION"

# Node.js 22.xが必要な場合（Netlify設定に合わせる）
if [[ "$NODE_VERSION" != "v22."* ]]; then
    log_warning "Node.js 22.xが推奨されます（現在: $NODE_VERSION）"
    log_warning "nvmまたはVoltaでバージョンを固定してください"
fi

# npmバージョンの確認
log_info "npmバージョンを確認..."
NPM_VERSION=$(npm --version 2>/dev/null || echo "not installed")
log_info "npm: $NPM_VERSION"

# npm 10.xが必要な場合
if [[ "$NPM_VERSION" != "10."* ]]; then
    log_warning "npm 10.xが推奨されます（現在: $NPM_VERSION）"
fi

# 1c. 依存のクリーン導入
log_info "依存関係をクリーンインストール..."
if [ -d "node_modules" ]; then
    log_info "既存のnode_modulesを削除..."
    rm -rf node_modules
fi
if [ -f "package-lock.json" ]; then
    log_info "既存のpackage-lock.jsonを削除..."
    rm -f package-lock.json
fi
if [ -d ".next" ]; then
    log_info "既存の.nextディレクトリを削除..."
    rm -rf .next
fi

log_info "npm installを実行..."
npm install 2>&1 | tee -a "$LOG_FILE"
if [ $? -eq 0 ]; then
    log_success "依存関係のインストールが完了しました"
else
    log_error "依存関係のインストールに失敗しました"
    exit 1
fi

# ============================================
# 2. 設定・構成の静的検査
# ============================================
log_section "2. 設定・構成の静的検査"

# 2a. パスエイリアス・Next構成の確認
if [ -f "tsconfig.json" ]; then
    log_info "tsconfig.jsonを確認..."
    if grep -q '"baseUrl"' tsconfig.json; then
        log_success "baseUrlが設定されています"
    else
        log_warning "baseUrlが設定されていません"
    fi
    
    if grep -q '"paths"' tsconfig.json; then
        log_success "pathsが設定されています"
    else
        log_warning "pathsが設定されていません"
    fi
else
    log_warning "tsconfig.jsonが見つかりません（Next.jsプロジェクトでない可能性）"
fi

# next.config.mjsの確認
if [ -f "next.config.mjs" ] || [ -f "next.config.js" ]; then
    log_info "next.configを確認..."
    CONFIG_FILE=$(ls next.config.* 2>/dev/null | head -1)
    if grep -q "webpack.resolve.alias" "$CONFIG_FILE"; then
        log_success "webpack.resolve.aliasが設定されています"
    else
        log_warning "webpack.resolve.aliasが設定されていません"
    fi
else
    log_warning "next.configが見つかりません（Next.jsプロジェクトでない可能性）"
fi

# 2b. 環境変数の整合性確認
log_info "環境変数の整合性を確認..."
if [ -f ".env.local" ]; then
    log_info ".env.localが存在します"
    
    # Firebase環境変数の確認
    REQUIRED_VARS=(
        "NEXT_PUBLIC_FIREBASE_API_KEY"
        "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"
        "NEXT_PUBLIC_FIREBASE_PROJECT_ID"
        "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"
        "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"
        "NEXT_PUBLIC_FIREBASE_APP_ID"
    )
    
    MISSING_VARS=()
    for VAR in "${REQUIRED_VARS[@]}"; do
        if grep -q "^${VAR}=" .env.local; then
            log_success "$VAR が設定されています"
        else
            log_warning "$VAR が設定されていません"
            MISSING_VARS+=("$VAR")
        fi
    done
    
    # Google Cloud環境変数の確認
    if grep -q "GOOGLE_APPLICATION_CREDENTIALS_JSON" .env.local; then
        log_success "GOOGLE_APPLICATION_CREDENTIALS_JSON が設定されています"
    else
        log_warning "GOOGLE_APPLICATION_CREDENTIALS_JSON が設定されていません"
    fi
    
    if grep -q "GOOGLE_PROJECT_ID" .env.local; then
        log_success "GOOGLE_PROJECT_ID が設定されています"
    else
        log_warning "GOOGLE_PROJECT_ID が設定されていません"
    fi
    
    # 環境変数の読み込み検証
    log_info "環境変数の読み込みを検証..."
    node --env-file=.env.local -e "console.log('NEXT_PUBLIC_FIREBASE_API_KEY:', process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? '✓' : '✗')" 2>&1 | tee -a "$LOG_FILE"
else
    log_warning ".env.localが見つかりません"
fi

# 2c. 構成ファイルの整合性確認
log_info "構成ファイルの整合性を確認..."

# netlify.tomlの確認
if [ -f "netlify.toml" ]; then
    log_info "netlify.tomlを確認..."
    if grep -q "build.base" netlify.toml; then
        log_success "build.baseが設定されています"
    else
        log_warning "build.baseが設定されていません"
    fi
    
    if grep -q "publish" netlify.toml; then
        log_success "publishが設定されています"
    else
        log_warning "publishが設定されていません"
    fi
    
    if grep -q "functions" netlify.toml; then
        log_success "functionsが設定されています"
    else
        log_warning "functionsが設定されていません"
    fi
else
    log_warning "netlify.tomlが見つかりません"
fi

# postcss.config.jsの確認
if [ -f "postcss.config.js" ] || [ -f "postcss.config.mjs" ]; then
    log_success "postcss.configが見つかりました"
else
    log_warning "postcss.configが見つかりません"
fi

# tailwind.config.tsの確認
if [ -f "tailwind.config.ts" ] || [ -f "tailwind.config.js" ]; then
    log_success "tailwind.configが見つかりました"
else
    log_warning "tailwind.configが見つかりません"
fi

# ============================================
# 3. コード面の重大リスク・不整合検査
# ============================================
log_section "3. コード面の重大リスク・不整合検査"

# 3a. クライアント/サーバー境界の破りチェック
log_info "クライアント/サーバー境界の破りをチェック..."

# firebase-adminのクライアント側インポートをチェック
if [ -d "src" ]; then
    if grep -r "firebase-admin" src/ --include="*.tsx" --include="*.ts" --include="*.jsx" --include="*.js" 2>/dev/null | grep -v "node_modules"; then
        log_error "firebase-adminがクライアント側コードからインポートされています！"
    else
        log_success "firebase-adminのクライアント側インポートは見つかりませんでした"
    fi
    
    if grep -r "@google-cloud" src/ --include="*.tsx" --include="*.ts" --include="*.jsx" --include="*.js" 2>/dev/null | grep -v "node_modules"; then
        log_error "@google-cloudパッケージがクライアント側コードからインポートされています！"
    else
        log_success "@google-cloudパッケージのクライアント側インポートは見つかりませんでした"
    fi
else
    log_warning "srcディレクトリが見つかりません"
fi

# 3b. 認証・鍵取り扱いのチェック
log_info "認証・鍵取り扱いをチェック..."

# サービスアカウントJSONのログ出力をチェック
if grep -r "console.log.*GOOGLE_APPLICATION_CREDENTIALS_JSON" . --include="*.ts" --include="*.js" --include="*.tsx" --include="*.jsx" 2>/dev/null | grep -v "node_modules" | grep -v ".git"; then
    log_error "サービスアカウントJSONがログに出力される可能性があります！"
else
    log_success "サービスアカウントJSONのログ出力は見つかりませんでした"
fi

# 3c. 非推奨APIの排除チェック
log_info "非推奨APIの使用をチェック..."

# GoogleAuthの初期化パターンをチェック
if [ -d "src" ]; then
    if grep -r "VideoIntelligenceServiceClient\|StorageClient" src/ --include="*.ts" --include="*.js" 2>/dev/null | grep -v "node_modules"; then
        log_info "Google Cloudクライアントの初期化を確認します..."
        # 詳細な確認は後続のPythonスクリプトで行う
    fi
fi

# 3d. 型定義・ビルドの健全性
log_info "型定義・ビルドの健全性を確認..."

if [ -f "package.json" ]; then
    # type-checkスクリプトの確認
    if grep -q "\"type-check\"" package.json; then
        log_info "type-checkスクリプトを実行..."
        npm run type-check 2>&1 | tee -a "$LOG_FILE" || log_warning "型チェックでエラーが発生しました"
    else
        log_warning "type-checkスクリプトが見つかりません"
    fi
fi

# ============================================
# 4. 実行時検査
# ============================================
log_section "4. 実行時検査"

# 4a. ビルド・起動
log_info "ビルドを実行..."
if grep -q "\"build\"" package.json; then
    npm run build 2>&1 | tee -a "$LOG_FILE"
    if [ $? -eq 0 ]; then
        log_success "ビルドが成功しました"
    else
        log_error "ビルドに失敗しました"
    fi
else
    log_warning "buildスクリプトが見つかりません"
fi

# ============================================
# 5. 失敗時の原因切り分け
# ============================================
log_section "5. 失敗時の原因切り分け"

# 5a. Module not found の確認
log_info "依存パッケージの存在を確認..."
if [ -f "package.json" ]; then
    # 主要な依存パッケージの確認
    npm ls 2>&1 | tee -a "$LOG_FILE" || log_warning "依存関係の確認でエラーが発生しました"
fi

# ============================================
# まとめ
# ============================================
log_section "診断完了"

log_info "診断ログは $LOG_FILE に保存されました"
log_info "次のステップ:"
log_info "  1. ログファイルを確認して問題を特定"
log_info "  2. 必要に応じて修復スクリプトを実行"
log_info "  3. 再度このスクリプトを実行して検証"

exit 0

