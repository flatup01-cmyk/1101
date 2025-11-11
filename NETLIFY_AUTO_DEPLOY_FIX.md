# Netlify自動デプロイ修復チェックリスト

## 🚨 即チェック（1分以内）

### 1. ローカルのpush先とブランチ確認

```bash
# リモート確認（期待値: github.com/flatup01-cmyk/1101.git）
git remote -v

# 現在のブランチ確認（期待値: main）
git branch --show-current
```

**期待される状態:**
- ✅ リモート: `github.com/flatup01-cmyk/1101.git`
- ✅ ブランチ: `main`

### 2. 新しいコミットで反応確認

```bash
# 小さな変更をコミット
echo "# Test $(date)" >> README.md
git add README.md
git commit -m "test: Netlify auto-deploy check"
git push origin main

# その後、Netlifyの「Deploys」ページでビルドが開始されるか確認
```

---

## 🔧 動かなければ順番に修復

### 修復1: GitHub → Netlify Webhookの再生成

**手順:**
1. Netlifyダッシュボード → サイト設定
2. 「Build & deploy」→「Continuous deployment」
3. 「Manage repository」→「Link to a different repository」
4. `flatup01-cmyk/1101`を選択
5. ブランチ: `main`を選択
6. 「Save」をクリック

**確認:**
- GitHubリポジトリの「Settings」→「Webhooks」でNetlifyのWebhookが存在するか
- 「Recent Deliveries」で200ステータスが返っているか

### 修復2: 自動公開が有効か確認

**手順:**
1. Netlifyダッシュボード →「Deploys」タブ
2. 「Lock to stop auto publishing」が表示されていれば自動公開ON
3. 「Unlock to resume」が表示されていればクリックして再開

### 修復3: キャッシュ無視の再ビルド

**手順:**
1. Netlifyダッシュボード →「Deploys」タブ
2. 最新のデプロイを選択
3. 「Retry without cache with latest branch commit」をクリック

### 修復4: netlify.tomlとUI設定の整合確認

**現在のnetlify.toml設定:**
```toml
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "20"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

**Netlify UI設定との整合性:**
- ✅ Build command: `npm run build`（一致）
- ✅ Publish directory: `dist`（一致）
- ✅ Node version: `20`（一致）

### 修復5: GitHub権限の確認

**手順:**
1. GitHub →「Settings」→「Applications」→「Installed GitHub Apps」
2. Netlifyアプリがインストールされているか確認
3. `flatup01-cmyk/1101`リポジトリへのアクセス権限があるか確認
4. リポジトリの可視性が最近変更されていないか確認（非公開→公開など）

### 修復6: 最終手段

**手順:**
1. Netlifyダッシュボード →「Deploys」タブ
2. 「Retry with latest branch commit」を試す
3. 動かなければ「Retry without cache with latest branch commit」を試す
4. それでもダメなら「Link to a different repository」で一度解除→再リンク

---

## 📋 推奨ワークフロー

### mainブランチへのpush手順

```bash
# 1. mainブランチに切り替え
git checkout main

# 2. 最新を取得
git pull origin main

# 3. 変更を適用
git add .
git commit -m "feat: 変更内容"
git push origin main

# 4. NetlifyのDeploysページで自動ビルドを確認
```

---

## ✅ 確認項目チェックリスト

- [ ] Gitリモートが`github.com/flatup01-cmyk/1101.git`である
- [ ] 現在のブランチが`main`である
- [ ] NetlifyのWebhookがGitHubに存在する
- [ ] WebhookのRecent Deliveriesが200で成功している
- [ ] Netlifyの自動公開が有効になっている
- [ ] netlify.tomlとUI設定が一致している
- [ ] GitHubアプリの権限が適切に設定されている
- [ ] リポジトリの可視性が公開になっている

---

## 🎯 最短修復コマンド（まとめ）

```bash
# 1. mainブランチに切り替え
git checkout main

# 2. 最新を取得
git pull origin main

# 3. 小さな変更でテストコミット
echo "# Auto-deploy test $(date)" >> README.md
git add README.md
git commit -m "test: Netlify auto-deploy check"
git push origin main

# 4. NetlifyのDeploysページで確認
# → ビルドが自動開始されれば成功
```
