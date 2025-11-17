# Secret Manager エイリアス「prod」への移行

## ✅ 完了した変更

### 1. Pythonコード (`functions/main.py`)
- `access_secret_version()` のデフォルト引数を `"latest"` → `"prod"` に変更
- DIFY_API_KEYの取得を `version_id="prod"` に変更
- LINE_CHANNEL_ACCESS_TOKENの取得を `["prod", "latest"]` に変更（フォールバック付き）

### 2. デプロイスクリプト (`deploy.sh`)
- `--update-secrets DIFY_API_KEY=DIFY_API_KEY:latest` → `DIFY_API_KEY:prod` に変更

## 🔧 実行が必要な作業

### 1. Secret Managerエイリアスの設定

**方法1: Google Cloud Consoleから設定（推奨）**

1. [Secret Manager Console](https://console.cloud.google.com/security/secret-manager?project=aikaapp-584fa) にアクセス
2. `DIFY_API_KEY` を選択
3. 最新バージョンを選択
4. 「エイリアスを追加」をクリック
5. エイリアス名: `prod` を入力して保存
6. 同様に `LINE_CHANNEL_ACCESS_TOKEN` にも `prod` エイリアスを設定

**方法2: gcloud alphaコマンドで設定**

```bash
# 最新バージョンを確認
./update_secret_aliases.sh

# DIFY_API_KEYのprodエイリアスを設定
LATEST_VERSION=$(gcloud secrets versions list DIFY_API_KEY --project=aikaapp-584fa --format="value(name)" --limit=1 --sort-by=~createTime | head -1)
VERSION_NUM=$(echo $LATEST_VERSION | awk -F'/' '{print $NF}')
gcloud alpha secrets versions add-version-alias prod $VERSION_NUM --secret=DIFY_API_KEY --project=aikaapp-584fa

# LINE_CHANNEL_ACCESS_TOKENのprodエイリアスを設定
LATEST_VERSION=$(gcloud secrets versions list LINE_CHANNEL_ACCESS_TOKEN --project=aikaapp-584fa --format="value(name)" --limit=1 --sort-by=~createTime | head -1)
VERSION_NUM=$(echo $LATEST_VERSION | awk -F'/' '{print $NF}')
gcloud alpha secrets versions add-version-alias prod $VERSION_NUM --secret=LINE_CHANNEL_ACCESS_TOKEN --project=aikaapp-584fa
```

### 2. Cloud Functionsの再デプロイ

```bash
# processVideoJob
gcloud functions deploy processVideoJob \
  --gen2 \
  --region=asia-northeast1 \
  --runtime=nodejs20 \
  --source=./functions \
  --entry-point=processVideoJob \
  --trigger-http \
  --allow-unauthenticated \
  --timeout=540s \
  --memory=2Gi \
  --max-instances=10 \
  --set-secrets=DIFY_API_KEY=DIFY_API_KEY:prod,LINE_CHANNEL_ACCESS_TOKEN=LINE_CHANNEL_ACCESS_TOKEN:prod \
  --project=aikaapp-584fa

# lineWebhookRouter
gcloud functions deploy lineWebhookRouter \
  --gen2 \
  --region=asia-northeast1 \
  --runtime=nodejs20 \
  --source=./functions \
  --entry-point=lineWebhookRouter \
  --trigger-http \
  --allow-unauthenticated \
  --timeout=300s \
  --memory=1Gi \
  --max-instances=10 \
  --set-secrets=MAKE_WEBHOOK_URL=MAKE_WEBHOOK_URL:prod,LINE_CHANNEL_ACCESS_TOKEN=LINE_CHANNEL_ACCESS_TOKEN:prod,DIFY_API_KEY=DIFY_API_KEY:prod \
  --set-env-vars=PROCESS_VIDEO_JOB_URL=https://processvideojob-kvuv4ufotq-an.a.run.app \
  --project=aikaapp-584fa

# process-video-trigger (Cloud Run)
./deploy.sh
```

## 📋 確認事項

### エイリアスの確認

```bash
# DIFY_API_KEYのエイリアス確認
gcloud secrets versions list DIFY_API_KEY --project=aikaapp-584fa --filter="aliases:prod"

# LINE_CHANNEL_ACCESS_TOKENのエイリアス確認
gcloud secrets versions list LINE_CHANNEL_ACCESS_TOKEN --project=aikaapp-584fa --filter="aliases:prod"
```

### アクセス権限の確認

```bash
# サービスアカウントにsecretmanager.secretAccessorロールが付与されているか確認
gcloud projects get-iam-policy aikaapp-584fa \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:639286700347-compute@developer.gserviceaccount.com" \
  --format="table(bindings.role)"
```

## 🔄 ローテーション手順

シークレットをローテーションする場合：

1. 新しいバージョンを作成
2. `prod`エイリアスを新しいバージョンに更新
3. コード変更は不要（エイリアスが自動的に新しいバージョンを参照）

```bash
# 新しいバージョンを作成
echo -n "NEW_SECRET_VALUE" | gcloud secrets versions add DIFY_API_KEY --data-file=- --project=aikaapp-584fa

# 最新バージョン番号を取得
NEW_VERSION=$(gcloud secrets versions list DIFY_API_KEY --project=aikaapp-584fa --format="value(name)" --limit=1 --sort-by=~createTime | awk -F'/' '{print $NF}')

# prodエイリアスを新しいバージョンに更新（Google Cloud Consoleから実行）
# または gcloud alphaコマンド:
gcloud alpha secrets versions update-alias prod --version=$NEW_VERSION --secret=DIFY_API_KEY --project=aikaapp-584fa
```

## ⚠️ 注意事項

- 本番環境以外（staging等）は別エイリアス（例: `staging`）を使用
- エイリアスが存在しない場合は、コードのフォールバック処理で`latest`が使用される
- デプロイ前に必ずエイリアスが設定されていることを確認

