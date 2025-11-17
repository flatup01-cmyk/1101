# 🚀 デプロイ準備完了ガイド

## ✅ 完了した作業

1. **認証・ヘッダー衛生管理の強化**
   - DIFY_API_KEYをSecret Managerから読み込むように変更
   - ASCIIサニタイズ関数を追加
   - requests.postをjson=payloadに変更
   - ヘッダーをASCIIのみに簡素化
   - パス検証の許容範囲を拡大

2. **コードのコミットとプッシュ**
   - 変更をコミット: `5c05285`
   - リモートリポジトリにプッシュ完了

---

## 📋 次のステップ

### ステップ1: Secret ManagerにDIFY_API_KEYを設定

#### 1-1. Secretが存在するか確認

```bash
gcloud secrets list --project=aikaapp-584fa --filter="name:DIFY_API_KEY"
```

#### 1-2. Secretが存在しない場合、作成

```bash
# Secret ManagerにAPIキーを保存
echo -n "あなたの有効なDify APIキー" | \
  gcloud secrets create DIFY_API_KEY \
  --data-file=- \
  --project=aikaapp-584fa \
  --replication-policy="automatic"
```

**重要**: APIキーにスペースや改行が含まれていないか確認してください。

#### 1-3. Secretが既に存在する場合、更新

```bash
# Secret ManagerのAPIキーを更新
echo -n "あなたの有効なDify APIキー" | \
  gcloud secrets versions add DIFY_API_KEY \
  --data-file=- \
  --project=aikaapp-584fa
```

---

### ステップ2: Cloud Runサービスアカウントに権限を付与

#### 2-1. サービスアカウントを確認

```bash
# Cloud Runサービスのサービスアカウントを確認
gcloud run services describe process-video-trigger \
  --region=us-central1 \
  --format="value(spec.template.spec.serviceAccountName)"
```

#### 2-2. Secret Managerへのアクセス権限を付与

```bash
# Cloud Runのデフォルトサービスアカウントに権限を付与
gcloud secrets add-iam-policy-binding DIFY_API_KEY \
  --member="serviceAccount:639286700347-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project=aikaapp-584fa
```

**注意**: サービスアカウントのメールアドレスは、上記コマンドで確認した値に置き換えてください。

---

### ステップ3: Cloud Runにデプロイ

#### 3-1. 現在のディレクトリを確認

```bash
cd /Users/jin/new-kingdom
```

#### 3-2. Cloud Runにデプロイ

```bash
gcloud run deploy process-video-trigger \
  --source=./functions \
  --region=us-central1 \
  --platform=managed \
  --allow-unauthenticated \
  --memory=2Gi \
  --timeout=540s \
  --max-instances=10 \
  --update-secrets DIFY_API_KEY=DIFY_API_KEY:latest \
  --set-env-vars DIFY_API_ENDPOINT=https://api.dify.ai/v1/chat-messages \
  --project=aikaapp-584fa
```

**オプション**: 環境変数としてDIFY_API_ENDPOINTを設定しない場合（デフォルト値を使用する場合）:

```bash
gcloud run deploy process-video-trigger \
  --source=./functions \
  --region=us-central1 \
  --platform=managed \
  --allow-unauthenticated \
  --memory=2Gi \
  --timeout=540s \
  --max-instances=10 \
  --update-secrets DIFY_API_KEY=DIFY_API_KEY:latest \
  --project=aikaapp-584fa
```

---

### ステップ4: デプロイ後の確認

#### 4-1. デプロイ状態を確認

```bash
# サービス一覧を確認
gcloud run services list --region=us-central1 --project=aikaapp-584fa

# サービス詳細を確認
gcloud run services describe process-video-trigger \
  --region=us-central1 \
  --project=aikaapp-584fa \
  --format="yaml"
```

#### 4-2. 環境変数とシークレットを確認

```bash
# 環境変数とシークレットを確認
gcloud run services describe process-video-trigger \
  --region=us-central1 \
  --project=aikaapp-584fa \
  --format="value(spec.template.spec.containers[0].env)" \
  --format="value(spec.template.spec.containers[0].envFrom)"
```

---

### ステップ5: テストと検証

#### 5-1. ログを監視

```bash
# リアルタイムでログを確認
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=process-video-trigger" \
  --limit=50 \
  --format=json \
  --project=aikaapp-584fa
```

#### 5-2. テスト動画をアップロード

1. **LINEアプリから動画をアップロード**
2. **LIFFアプリから動画をアップロード**

#### 5-3. ログで確認すべき項目

- ✅ `✅ DIFY_API_KEYをSecret Managerから読み込みました`
- ✅ `📋 Dify API設定確認:`
- ✅ `✅ Dify API呼び出し成功:`
- ❌ `❌ Dify API 401認証エラー`が表示されないこと
- ❌ `ERR_INVALID_CHAR`エラーが表示されないこと
- ❌ `latin-1`エラーが表示されないこと

---

## 🔍 トラブルシューティング

### エラー1: Secret Managerへのアクセス権限がない

**エラーメッセージ**:
```
Permission denied on resource projects/aikaapp-584fa/secrets/DIFY_API_KEY
```

**解決方法**:
```bash
# サービスアカウントに権限を付与
gcloud secrets add-iam-policy-binding DIFY_API_KEY \
  --member="serviceAccount:639286700347-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project=aikaapp-584fa
```

### エラー2: Secretが存在しない

**エラーメッセージ**:
```
Secret [DIFY_API_KEY] not found
```

**解決方法**:
```bash
# Secretを作成
echo -n "あなたの有効なDify APIキー" | \
  gcloud secrets create DIFY_API_KEY \
  --data-file=- \
  --project=aikaapp-584fa \
  --replication-policy="automatic"
```

### エラー3: 401認証エラーが依然として発生する

**確認事項**:
1. Secret ManagerのAPIキーが正しいか確認
2. APIキーに余分な空白や改行が含まれていないか確認
3. Dify StudioでAPIキーが有効か確認

**解決方法**:
```bash
# Secret ManagerのAPIキーを確認（マスクされて表示される）
gcloud secrets versions access latest \
  --secret="DIFY_API_KEY" \
  --project=aikaapp-584fa
```

---

## ⚠️ 注意事項

1. **APIキーの形式**: DifyのAPIキーは通常`app-`で始まります
2. **Secret Managerのバージョン**: `latest`を使用する場合、更新時に自動的に反映されます
3. **環境変数のフォールバック**: Secret Managerから読み込めない場合、環境変数から読み込む（後方互換性のため）
4. **リージョン**: `us-central1`を使用していますが、必要に応じて変更してください

---

## 📊 期待される結果

デプロイ後、以下のような動作が期待されます：

1. **Secret ManagerからAPIキーを読み込む**
   - ログに`✅ DIFY_API_KEYをSecret Managerから読み込みました`が表示される

2. **ASCIIサニタイズが機能する**
   - APIキーが正しくサニタイズされ、ヘッダーに設定される

3. **requests.postが正常に動作する**
   - `json=payload`でリクエストが送信され、401エラーが発生しない

4. **動画解析が正常に完了する**
   - 動画がアップロードされ、解析が完了し、LINEメッセージが送信される

---

**最終更新**: 2025-11-15  
**状態**: 🚀 デプロイ準備完了  
**次のステップ**: Secret ManagerにDIFY_API_KEYを設定してデプロイ

