# 🔧 Cloud Run CORSポリシーエラー解決ガイド

## ❌ エラー

```
ソースバケットのCORSポリシー構成が正しくないため、関数ソースを取得できませんでした。
ローカルのファイアウォールやVPNがアクセスをブロックしている可能性もあります。
```

## ✅ 解決方法

### 方法1: gcloudコマンドで直接デプロイ（推奨・最も簡単）

Cloud Runのコンソール経由ではなく、`gcloud`コマンドで直接デプロイすることで、CORSポリシーの問題を回避できます。

#### ステップ1: 現在のディレクトリを確認

```bash
cd /Users/jin/new-kingdom
```

#### ステップ2: Cloud Runサービスを直接デプロイ

```bash
gcloud run deploy process-video-trigger \
  --source=./functions \
  --region=us-central1 \
  --platform=managed \
  --allow-unauthenticated \
  --memory=2Gi \
  --timeout=540s \
  --max-instances=10 \
  --set-env-vars DIFY_API_ENDPOINT=https://api.dify.ai/v1/chat-messages,DIFY_API_KEY=あなたのAPIキー
```

**重要**: 環境変数は既に設定されている場合は、`--update-env-vars`を使用：

```bash
gcloud run services update process-video-trigger \
  --region=us-central1 \
  --update-env-vars DIFY_API_ENDPOINT=https://api.dify.ai/v1/chat-messages,DIFY_API_KEY=あなたのAPIキー
```

#### ステップ3: 環境変数をSecret Managerから読み込む場合

```bash
gcloud run deploy process-video-trigger \
  --source=./functions \
  --region=us-central1 \
  --platform=managed \
  --update-secrets DIFY_API_KEY=dify-api-key:latest,LINE_CHANNEL_ACCESS_TOKEN=line-access-token:latest
```

---

### 方法2: Cloud StorageバケットのCORSポリシーを設定

Cloud Runが使用するソースバケットのCORSポリシーを設定します。

#### ステップ1: Cloud Runのソースバケット名を確認

Cloud Runは通常、以下のバケットを使用します：
- `[PROJECT_ID]-cloudbuild` 
- `gcf-sources-[REGION]-[PROJECT_NUMBER]`

確認方法：

```bash
# Cloud Runサービスで使用されているバケットを確認
gcloud run services describe process-video-trigger \
  --region=us-central1 \
  --format="value(spec.template.spec.containers[0].image)"
```

または、Cloud Buildの設定を確認：

```bash
gcloud builds list --limit=5
```

#### ステップ2: CORS設定ファイルを作成

```bash
cat > cors.json << 'EOF'
[
  {
    "origin": ["*"],
    "method": ["GET", "HEAD", "PUT", "POST", "DELETE"],
    "responseHeader": ["Content-Type", "Authorization", "Content-Length", "User-Agent", "x-goog-resumable"],
    "maxAgeSeconds": 3600
  }
]
EOF
```

#### ステップ3: CORS設定を適用

```bash
# Cloud BuildバケットにCORS設定を適用
gsutil cors set cors.json gs://aikaapp-584fa-cloudbuild

# または、プロジェクト番号を使用したバケット名
# gsutil cors set cors.json gs://gcf-sources-us-central1-[PROJECT_NUMBER]
```

#### ステップ4: 設定を確認

```bash
gsutil cors get gs://aikaapp-584fa-cloudbuild
```

---

### 方法3: Cloud Build APIを有効化

Cloud RunのデプロイにはCloud Build APIが必要です。有効化されていない場合は有効化します。

```bash
# Cloud Build APIを有効化
gcloud services enable cloudbuild.googleapis.com

# Cloud Run APIを有効化
gcloud services enable run.googleapis.com

# Artifact Registry APIを有効化
gcloud services enable artifactregistry.googleapis.com
```

---

## 🔍 現在の設定を確認

### サービス情報の確認

```bash
# Cloud Runサービスの詳細を確認
gcloud run services describe process-video-trigger \
  --region=us-central1 \
  --format=yaml
```

### 環境変数の確認

```bash
# 環境変数を確認
gcloud run services describe process-video-trigger \
  --region=us-central1 \
  --format="value(spec.template.spec.containers[0].env)"
```

### ログの確認

```bash
# 最新のログを確認
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=process-video-trigger" \
  --limit=50 \
  --format=json
```

---

## 📝 推奨されるデプロイコマンド（完全版）

環境変数をSecret Managerから読み込む場合：

```bash
cd /Users/jin/new-kingdom

gcloud run deploy process-video-trigger \
  --source=./functions \
  --region=us-central1 \
  --platform=managed \
  --allow-unauthenticated \
  --memory=2Gi \
  --timeout=540s \
  --max-instances=10 \
  --update-secrets DIFY_API_KEY=dify-api-key:latest,LINE_CHANNEL_ACCESS_TOKEN=line-access-token:latest \
  --set-env-vars DIFY_API_ENDPOINT=https://api.dify.ai/v1/chat-messages
```

環境変数を直接設定する場合：

```bash
cd /Users/jin/new-kingdom

gcloud run deploy process-video-trigger \
  --source=./functions \
  --region=us-central1 \
  --platform=managed \
  --allow-unauthenticated \
  --memory=2Gi \
  --timeout=540s \
  --max-instances=10 \
  --set-env-vars DIFY_API_ENDPOINT=https://api.dify.ai/v1/chat-messages,DIFY_API_KEY=あなたのAPIキー,LINE_CHANNEL_ACCESS_TOKEN=あなたのLINEトークン
```

---

## ⚠️ 注意事項

1. **リージョンの確認**: `us-central1`を使用していますが、実際のリージョンに合わせて変更してください
2. **環境変数**: 機密情報はSecret Managerを使用することを推奨します
3. **メモリとタイムアウト**: 動画解析には2GB以上のメモリと540秒のタイムアウトを推奨
4. **認証**: `--allow-unauthenticated`を削除すると、認証が必要になります

---

## 🚀 次のステップ

1. **方法1を試す**: gcloudコマンドで直接デプロイ（最も簡単）
2. **デプロイ後**: 新しい動画をアップロードしてテスト
3. **ログを確認**: デバッグログが正しく出力されているか確認
4. **401エラーを確認**: Dify APIの認証エラーが解消されたか確認

---

**最終更新**: 2025-11-15  
**状態**: 🔧 解決方法を実装中

