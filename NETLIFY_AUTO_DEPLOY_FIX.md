# Netlify自動デプロイ修復チェックリスト

## 🚨 即チェック（1分以内）

### 1. ローカルのpush先とブランチ確認
```bash
git remote -v  # 期待値: github.com/flatup01-cmyk/1101.git
git branch --show-current  # 期待値: main
```

### 2. 新しいコミットで反応確認
```bash
echo "# Test $(date)" >> README.md
git add README.md
git commit -m "test: Netlify auto-deploy check"
git push origin main
# Netlifyの「Deploys」ページでビルド開始を確認
```

## 🔧 修復手順（順番に実行）

### 修復1: Webhook再生成
Netlify → Build & deploy → Continuous deployment → Manage repository → Link to a different repository → flatup01-cmyk/1101 (main)

### 修復2: 自動公開確認
Deploysページで「Unlock to resume」があればクリック

### 修復3: キャッシュ無視再ビルド
Deploys → 「Retry without cache with latest branch commit」

### 修復4: GitHub権限確認
GitHub → Settings → Applications → Installed GitHub Apps → Netlify → flatup01-cmyk/1101の権限確認

### 修復5: 最終手段
Deploys → 「Retry with latest branch commit」→ 動かなければ「Link to a different repository」で再リンク
