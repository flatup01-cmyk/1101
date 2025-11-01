# 🚀 AIKA18号 革命的アップグレード デプロイ手順書

## 📋 デプロイ前チェックリスト

### ✅ 必須項目

- [ ] Secret Managerに`line-channel-access-token`が設定されている
- [ ] 環境変数`DIFY_API_ENDPOINT`と`DIFY_API_KEY`が設定されている（または設定予定）
- [ ] Firebase Storageルールが100MB制限に更新されている
- [ ] `functions/requirements.txt`に`google-cloud-secret-manager==2.20.0`が追加されている
- [ ] `functions/main.py`が最新版（要塞化版）に更新されている

---

## 🔧 ステップ1: Secret Managerの確認

### 1.1 シークレットの存在確認

```bash
gcloud secrets list --project=aikaapp-584fa
```

**期待される出力**:
```
NAME                          CREATED              REPLICATION  LOCATIONS
line-channel-access-token     YYYY-MM-DD HH:MM:SS  automatic    -
```

### 1.2 シークレットの値確認（オプション）

```bash
gcloud secrets versions access latest \
  --secret="line-channel-access-token" \
  --project=aikaapp-584fa
```

**注意**: アクセストークンが正しく表示されることを確認してください。

---

## 📦 ステップ2: Cloud Functionsのデプロイ

### 2.1 依存関係のインストール確認

```bash
cd functions
pip install -r requirements.txt
```

**確認事項**:
- `google-cloud-secret-manager==2.20.0`がインストールされる
- エラーが発生しない

### 2.2 Firebase Storage トリガーの設定確認

`firebase.json`または`functions/main.py`でStorageイベントトリガーが正しく設定されているか確認：

```json
{
  "functions": [
    {
      "source": "functions",
      "codebase": "default",
      "runtime": "python311"
    }
  ],
  "storage": {
    "rules": "storage.rules"
  }
}
```

### 2.3 Cloud Functionsのデプロイ

```bash
# プロジェクトルートから
firebase deploy --only functions

# または、特定の関数のみ
firebase deploy --only functions:process_video_trigger
```

**デプロイ時の注意**:
- 初回デプロイは5-10分かかることがあります
- エラーが出た場合は、`DEPLOYMENT_ERRORS.md`を参照してください

---

## 🔐 ステップ3: 環境変数の設定

### 3.1 Dify API設定（必須ではないが推奨）

```bash
firebase functions:config:set \
  dify.api_endpoint="https://api.dify.ai/v1/workflows/run" \
  dify.api_key="your-dify-api-key"
```

### 3.2 環境変数の確認

```bash
firebase functions:config:get
```

**期待される出力**:
```json
{
  "dify": {
    "api_endpoint": "https://api.dify.ai/v1/workflows/run",
    "api_key": "your-dify-api-key"
  }
}
```

**注意**: `line-channel-access-token`はSecret Managerから読み込まれるため、環境変数に設定する必要は**ありません**。

---

## 🧪 ステップ4: デプロイ後のテスト

### 4.1 Cloud Functionsログの確認

```bash
# リアルタイムでログを確認
firebase functions:log --only process_video_trigger

# または、gcloudコマンドで
gcloud functions logs read process_video_trigger \
  --project=aikaapp-584fa \
  --limit=50
```

**確認すべきログ**:
- ✅ `Secret ManagerからLINEアクセストークンを読み込みました`
- ✅ エラーメッセージがない

### 4.2 テスト動画のアップロード

1. LIFFアプリにアクセス
2. 10秒以内、100MB以内の動画をアップロード
3. Cloud Functionsログで処理を確認

**期待される動作**:
- ✅ アップロードが成功
- ✅ Cloud Functionsが自動トリガー
- ✅ Firestoreに`video_jobs/{jobId}`が作成される
- ✅ status: 'pending' → 'processing' → 'completed'
- ✅ LINEメッセージが届く

---

## 🔄 ステップ5: Firebase Storageルールの更新確認

### 5.1 現在のルール確認

```bash
firebase firestore:rules:get
```

### 5.2 100MB制限の確認

`storage.rules`を確認：

```javascript
allow write: if request.resource.size < 100 * 1024 * 1024; // 100MB制限
```

### 5.3 ルールのデプロイ（必要に応じて）

```bash
firebase deploy --only storage
```

---

## 📊 ステップ6: Firestoreインデックスの作成（推奨）

### 6.1 必要なインデックス

以下のクエリが発生する場合、インデックスが必要です：

- `video_jobs`コレクションの`status`フィールドでフィルタリング
- `rate_limits`コレクションの`user_id`フィールドでフィルタリング

### 6.2 インデックスの自動作成

Firebaseコンソールでエラーメッセージを確認し、リンクからインデックスを作成してください。

または、`firestore.indexes.json`を作成：

```json
{
  "indexes": [
    {
      "collectionGroup": "video_jobs",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "status",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "createdAt",
          "order": "DESCENDING"
        }
      ]
    }
  ]
}
```

---

## ⚠️ トラブルシューティング

### 問題1: Secret Managerから読み込めない

**症状**:
```
⚠️ Secret Managerからの読み込み失敗。環境変数にフォールバック
```

**解決策**:
1. Secret Managerのシークレット名を確認: `line-channel-access-token`
2. Cloud FunctionsのサービスアカウントにSecret Managerへのアクセス権限があるか確認

```bash
# サービスアカウントに権限付与
gcloud projects add-iam-policy-binding aikaapp-584fa \
  --member="serviceAccount:aikaapp-584fa@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### 問題2: Cloud Functionsがトリガーされない

**症状**: StorageにアップロードしてもFunctionが起動しない

**解決策**:
1. Storageイベントトリガーの設定を確認
2. `firebase.json`にStorage設定があるか確認
3. Cloud Functionsのログでエラーがないか確認

### 問題3: LINE API送信が失敗する

**症状**: 
```
❌ CRITICAL: LINE通知失敗（3回リトライ後）
```

**解決策**:
1. Secret Managerのトークンが正しいか確認
2. LINE Channel Access Tokenの有効期限を確認
3. Cloud Loggingで詳細なエラーログを確認

---

## 📈 パフォーマンス監視

### Cloud Loggingでの監視

```bash
# エラーログを確認
gcloud logging read "severity>=ERROR" \
  --project=aikaapp-584fa \
  --limit=50

# CRITICALアラートを確認
gcloud logging read 'jsonPayload.severity="CRITICAL"' \
  --project=aikaapp-584fa \
  --limit=50
```

### Firestoreでの処理状況確認

Firebaseコンソールで`video_jobs`コレクションを確認：
- `status: 'completed'`のドキュメント数
- `notification_sent: true`のドキュメント数
- エラー率（`status: 'error'`の割合）

---

## ✅ デプロイ完了確認

以下の全ての項目が✅になればデプロイ完了です：

- [ ] Secret ManagerからLINEアクセストークンが読み込める
- [ ] Cloud FunctionsがStorageイベントで自動トリガーされる
- [ ] 動画解析が正常に実行される
- [ ] Dify APIからメッセージが取得できる（設定済みの場合）
- [ ] LINE APIでメッセージが送信される
- [ ] Firestoreに`status: 'completed'`が記録される
- [ ] 冪等性が保証される（重複実行で重複通知がない）
- [ ] エラー時もユーザーに通知が届く

---

**最終更新**: 2025-01-XX  
**作成者**: AI Assistant (Auto)

