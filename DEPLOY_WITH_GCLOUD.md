# 🔧 gcloudコマンドでFirebase Functionsをデプロイ

## 概要

Firebase CLIがパスにスペースがある場合に問題を起こすため、`gcloud`コマンドを直接使用してデプロイします。

---

## 📋 前提条件

### 1. Google Cloud SDKのインストール

```bash
# インストール確認
gcloud --version

# インストールされていない場合
# macOS:
brew install google-cloud-sdk

# または公式サイトから:
# https://cloud.google.com/sdk/docs/install
```

### 2. 認証

```bash
gcloud auth login
gcloud config set project aikaapp-584fa
```

---

## 🚀 デプロイ手順

### ステップ1: ソースコードをZIPに圧縮

```bash
cd "/Users/jin/Library/CloudStorage/Dropbox/NEW WORLD/1101 new"

# functionsディレクトリをZIPに圧縮（venvは除外）
cd functions
zip -r ../functions-source.zip . -x "venv/*" -x "__pycache__/*" -x "*.pyc" -x ".git/*"
cd ..
```

### ステップ2: Cloud Functionsにデプロイ

```bash
gcloud functions deploy process_video_trigger \
  --gen2 \
  --runtime=python312 \
  --region=asia-northeast1 \
  --source=./functions \
  --entry-point=process_video_trigger \
  --trigger-storage \
  --trigger-bucket=aikaapp-584fa.appspot.com \
  --trigger-path-prefix=videos/ \
  --set-env-vars DIFY_API_ENDPOINT=https://api.dify.ai/v1/chat-messages,DIFY_API_KEY=app-6OBnNxu0oWUiMVVq0rjepVhJ,LINE_CHANNEL_ACCESS_TOKEN=dmEAWqyaDSsjpiTT4+i7YUD9I+nW2SV7O+i1XbjvIDMvbRP3CrJBG9kqGH34fZ98cQVfw9ldezkWUqlgLMBB1MtN1z2J/I2efQVA1grXYoz30SbK1DVVlzKu5PqEL91Px1FHoqUkzxPnTeAwoWWmlwdB04t89/1O/w1cDnyilFU= \
  --memory=2GB \
  --timeout=540s \
  --max-instances=10
```

---

## 📝 環境変数を別途設定する場合

### 方法1: Secret Managerを使用（推奨）

```bash
# Secretを作成
echo -n "app-6OBnNxu0oWUiMVVq0rjepVhJ" | gcloud secrets create dify-api-key --data-file=-

echo -n "dmEAWqyaDSsjpiTT4+i7YUD9I+nW2SV7O+i1XbjvIDMvbRP3CrJBG9kqGH34fZ98cQVfw9ldezkWUqlgLMBB1MtN1z2J/I2efQVA1grXYoz30SbK1DVVlzKu5PqEL91Px1FHoqUkzxPnTeAwoWWmlwdB04t89/1O/w1cDnyilFU=" | \
  gcloud secrets create line-access-token --data-file=-

# 関数を更新
gcloud functions deploy process_video_trigger \
  --gen2 \
  --runtime=python312 \
  --region=asia-northeast1 \
  --source=./functions \
  --update-secrets DIFY_API_KEY=dify-api-key:latest,LINE_CHANNEL_ACCESS_TOKEN=line-access-token:latest
```

### 方法2: 環境変数を直接設定

```bash
gcloud functions deploy process_video_trigger \
  --update-env-vars DIFY_API_ENDPOINT=https://api.dify.ai/v1/chat-messages,DIFY_API_KEY=app-6OBnNxu0oWUiMVVq0rjepVhJ
```

---

## 🔍 デプロイ状態の確認

```bash
# 関数の一覧
gcloud functions list

# 関数の詳細
gcloud functions describe process_video_trigger --gen2 --region=asia-northeast1

# ログの確認
gcloud functions logs read process_video_trigger --gen2 --region=asia-northeast1 --limit=50
```

---

## ⚠️ 注意事項

1. **region（リージョン）を確認**
   - `asia-northeast1`（東京）を使用
   - 必要に応じて変更

2. **trigger-path-prefix**
   - `videos/`で始まるファイルのみトリガー
   - Storageルールと一致させる

3. **メモリとタイムアウト**
   - 動画解析には2GB以上のメモリを推奨
   - タイムアウトは540秒（9分）を推奨

---

## 🐛 トラブルシューティング

### エラー: "Function failed on loading user code"

**原因:** 依存関係がインストールされていない

**解決:**
```bash
cd functions
source venv/bin/activate
pip install -r requirements.txt
cd ..
```

### エラー: "Permission denied"

**原因:** 必要な権限がない

**解決:**
```bash
gcloud projects add-iam-policy-binding aikaapp-584fa \
  --member="user:your-email@gmail.com" \
  --role="roles/cloudfunctions.developer"
```

---

## 📚 参考資料

- [Cloud Functions Gen2 ドキュメント](https://cloud.google.com/functions/docs/2nd-gen/create-deploy)
- [gcloud functions deploy コマンド](https://cloud.google.com/sdk/gcloud/reference/functions/deploy)

---

**最終更新:** 2025-01-XX  
**作成者:** AI Assistant (Auto)

