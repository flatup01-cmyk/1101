# Netlify UI変更が反映されない場合の対処法

## 問題の原因

デプロイは成功しているが、UIが変わらない場合、以下の原因が考えられます：

1. **同じdistが再デプロイされている**
   - 「All files already uploaded」というログが出る
   - ビルド成果物に差分がない

2. **ブラウザキャッシュ**
   - 古いバージョンがキャッシュされている

## 解決方法

### 方法1: フロントエンドのソースコードを変更してdistに差分を出す

```bash
# 1. index.htmlやsrc/main.jsなどのソースコードを変更
# 例: タイトルやメッセージを変更

# 2. 変更をコミット・プッシュ
git add index.html src/
git commit -m "fix: UI変更を反映"
git push origin main

# 3. Netlify側で自動ビルドが実行され、新しいdistが生成される
```

### 方法2: キャッシュを無視して再ビルド

1. Netlifyダッシュボード →「Deploys」タブ
2. 最新のデプロイを選択
3. 「Retry without cache with latest branch commit」をクリック

### 方法3: ブラウザキャッシュをクリア

- Mac: `Cmd + Shift + R`（ハードリロード）
- Windows: `Ctrl + Shift + R`
- または、クエリパラメータ付きでアクセス: `https://aika18.netlify.app?ts=20251111`

## 確認方法

### NetlifyのDeploy detailsで確認

- 「n new file(s)」と表示されれば、新しいファイルが生成されている
- 「All files already uploaded」の場合は、まだ同じ内容

### ビルドログで確認

- ビルドログに「Building...」→「Published」と表示されれば成功
- ファイルハッシュが変わっているか確認

## 現在の設定確認

- ✅ netlify.toml: `publish = "dist"`（正しい）
- ✅ build command: `npm run build`（正しい）
- ✅ ソースコード: `index.html`, `src/`（変更可能）

## 推奨ワークフロー

```bash
# 1. ソースコードを変更（index.html、src/main.js、src/style.cssなど）
# 例: タイトル、メッセージ、スタイルを変更

# 2. ローカルでビルドして確認（オプション）
npm run build

# 3. 変更をコミット・プッシュ
git add index.html src/
git commit -m "feat: UI更新"
git push origin main

# 4. NetlifyのDeploysページで確認
# → 新しいビルドが開始され、「n new file(s)」と表示される

# 5. ブラウザで確認（キャッシュクリア）
# → Cmd+Shift+R または ?ts=20251111 付きでアクセス
```

