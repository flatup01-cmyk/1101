# 🔍 Dify API 401認証エラー 診断・解決ガイド

## ❌ 問題

Cloud Runのログで以下のエラーが発生しています：

```
WARNING:main:⚠️ Dify API request failed, retrying in 1.0s (attempt 1/3): HTTP 401: {"code":"unauthorized","message":"Access token is invalid","status":401}
ERROR:main:❌ Dify MCP APIエラー: HTTP 401: {"code":"unauthorized","message":"Access token is invalid","status":401}
```

## 📋 原因の可能性

1. **DIFY_API_KEYが設定されていない**
2. **DIFY_API_KEYが無効または期限切れ**
3. **DIFY_API_KEYに余分な空白や改行が含まれている**
4. **DIFY_API_ENDPOINTが間違っている**
5. **Cloud Runの環境変数が正しく設定されていない**

## 🔧 診断手順

### ステップ1: ログで環境変数の状態を確認

最新のログを確認してください：

```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=process-video-trigger" --limit 50 --format json
```

以下のログが出力されているはずです：

```
INFO:main:📋 Dify API設定確認:
INFO:main:   - ENDPOINT: https://api.dify.ai/v1/chat-messages
INFO:main:   - API_KEY: app-6OBnN... (長さ: XX)
```

**確認ポイント**:
- `ENDPOINT`が正しいエンドポイントになっているか
- `API_KEY`の先頭が `app-` で始まっているか
- `API_KEY`の長さが適切か（通常は20文字以上）

### ステップ2: Cloud Runの環境変数を確認

```bash
gcloud run services describe process-video-trigger \
  --region=us-central1 \
  --format="value(spec.template.spec.containers[0].env)"
```

または、Google Cloud Consoleで確認：
1. Cloud Run → `process-video-trigger` → 「編集と新しいリビジョンをデプロイ」
2. 「変数とシークレット」タブを開く
3. `DIFY_API_KEY`と`DIFY_API_ENDPOINT`が設定されているか確認

### ステップ3: Dify APIキーを確認

1. **Dify Studioにアクセス**
   - https://dify.ai
   - あなたのワークスペースにログイン

2. **API Keysを確認**
   - 設定 → API Keys
   - 使用中のAPIキーが有効か確認
   - 無効な場合は、新しいAPIキーを発行

## ✅ 解決方法

### 方法1: Cloud Runの環境変数を更新（推奨）

```bash
gcloud run services update process-video-trigger \
  --region=us-central1 \
  --set-env-vars DIFY_API_ENDPOINT=https://api.dify.ai/v1/chat-messages,DIFY_API_KEY=あなたの有効なAPIキー
```

**重要**: APIキーにスペースや改行が含まれていないか確認してください。

### 方法2: Secret Managerを使用（より安全）

```bash
# Secret ManagerにAPIキーを保存
echo -n "あなたの有効なAPIキー" | \
  gcloud secrets create dify-api-key --data-file=- --project=aikaapp-584fa

# Cloud RunのサービスアカウントにSecret Managerへのアクセス権限を付与
gcloud run services update process-video-trigger \
  --region=us-central1 \
  --update-secrets DIFY_API_KEY=dify-api-key:latest
```

### 方法3: Google Cloud Consoleで設定

1. **Cloud Run → `process-video-trigger`** → 「編集と新しいリビジョンをデプロイ」

2. **「変数とシークレット」タブを開く**

3. **環境変数を追加/更新**:
   - `DIFY_API_ENDPOINT`: `https://api.dify.ai/v1/chat-messages`
   - `DIFY_API_KEY`: あなたの有効なAPIキー（余分な空白がないか確認）

4. **「デプロイ」をクリック**

## 🔍 デバッグ用の改善

コードに以下のデバッグログが追加されています：

1. **環境変数の状態をログに出力**:
   - APIキーの先頭10文字（マスク済み）
   - APIキーの長さ
   - エンドポイントURL

2. **401エラー時の詳細情報**:
   - API URL
   - APIキーの先頭10文字
   - エラーレスポンスの詳細

これらのログを確認して、問題の原因を特定してください。

## ⚠️ 注意事項

1. **APIキーの形式**: DifyのAPIキーは通常 `app-` で始まります
2. **空白や改行**: APIキーに余分な空白や改行が含まれていないか確認
3. **エンドポイント**: ワークスペースによってエンドポイントが異なる場合があります
4. **Secret Managerのバージョン**: `latest`を使用する場合、更新時に自動的に反映されます

## 📝 次のステップ

1. 環境変数を更新後、新しい動画をアップロードしてテスト
2. Cloud Runのログを確認して、401エラーが解消されたか確認
3. まだエラーが発生する場合、デバッグログを確認して詳細な原因を特定

