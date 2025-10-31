# 🔒 AIKA Battle Scouter セキュリティ対策ガイド

## 実装済みのセキュリティ対策

### ✅ 1. レートリミット機能

**実装場所:** `functions/rate_limiter.py`

**機能:**
- ユーザーごとに1日あたり最大10回の動画アップロードを制限
- 1時間あたり最大3回の連続アップロードを制限
- Firestoreでリクエスト履歴を管理

**動作:**
- 上限超過時、LINEでユーザーに通知
- 自動的に処理を拒否し、コストを抑制

**設定変更:**
`functions/rate_limiter.py`の`RATE_LIMIT_CONFIG`で調整可能：

```python
RATE_LIMIT_CONFIG = {
    'upload_video': {
        'max_requests': 10,  # 1日の最大数
        'window_seconds': 86400,  # 24時間
        'short_window_requests': 3,  # 1時間の最大数
        'short_window_seconds': 3600,  # 1時間
    }
}
```

---

### ✅ 2. Firebase Storageセキュリティルール

**実装場所:** `storage.rules`

**保護内容:**
- ✅ 認証ユーザーのみアップロード可能
- ✅ 自分のユーザーIDフォルダにのみアップロード可能
- ✅ 動画ファイル形式のみ許可（.mp4, .mov, .avi, .mkv）
- ✅ 100MB以下のファイルのみ許可
- ✅ 自分のファイルのみ読み取り・削除可能
- ✅ デフォルトで全てのアクセスを拒否

**デプロイ方法:**
```bash
firebase deploy --only storage
```

---

### ✅ 3. APIキーの保護

**現在の状態:**
- ✅ **機密情報はサーバーサイドのみ**（Cloud Functions）
  - Dify API Key: 環境変数で管理（`DIFY_API_KEY`）
  - LINE Channel Access Token: 環境変数で管理（`LINE_CHANNEL_ACCESS_TOKEN`）
  - これらはクライアントサイドに露出していません

- ⚠️ **Firebase API Key**（クライアントサイドに公開）
  - Firebaseの設計上、公開情報として扱われます
  - セキュリティは**Firebase Authentication**と**Storage Rules**で保護されます
  - API Keyのみでは何もできません（認証が必要）

**推奨改善:**
- Secret Managerを使用してより安全に管理（オプション）
- 定期的にAPIキーをローテーション

---

### ✅ 4. ファイルサイズ制限

**フロントエンド:** `src/main.js`
- クライアント側で100MB制限をチェック

**サーバー側:** `storage.rules`
- Storage Rulesで100MB制限を強制

---

## 📋 次のステップ（必須）

### 1. Firebase Storageルールのデプロイ

```bash
cd "/Users/jin/Library/CloudStorage/Dropbox/NEW WORLD/1101 new"
firebase deploy --only storage
```

---

### 2. GCP請求アラートの設定

詳細は `GCP_BILLING_ALERT.md` を参照してください。

**最低限の設定:**
1. GCP Console → 予算とアラート
2. 予算を作成（月額上限を設定）
3. 50%, 80%, 100%でアラートを設定

---

### 3. ログ監視の設定

詳細は `LOGGING_MONITORING.md` を参照してください。

**最低限の設定:**
- Firebase Console → Functions → ログで監視
- 異常なエラーやレートリミット超過を確認

---

## 🛡️ 追加のセキュリティ対策（推奨）

### 1. Cloudflare（DDoS対策）

Netlifyは自動でDDoS対策を提供していますが、追加でCloudflareを導入可能：

1. Cloudflareアカウントを作成
2. Netlifyのドメインを追加
3. DNS設定をCloudflareに変更

---

### 2. WAF（Web Application Firewall）

Netlifyは自動でWAFを提供しています。

**設定確認:**
- Netlify Console → Security → DDoS protection（自動有効）

---

### 3. HTTPS

✅ **既に実装済み**
- Netlifyは自動でLet's Encrypt証明書を発行
- すべての通信はHTTPS

---

### 4. Secret Manager（本番環境推奨）

機密情報をSecret Managerに移動：

```bash
# LINE Access Tokenを登録
echo -n "your_token" | gcloud secrets create line-access-token \
  --data-file=- --project=aikaapp-584fa

# Dify API Keyを登録
echo -n "your_key" | gcloud secrets create dify-api-key \
  --data-file=- --project=aikaapp-584fa
```

**Cloud Functions側の変更:**
```python
from google.cloud import secretmanager

def get_secret(secret_id):
    client = secretmanager.SecretManagerServiceClient()
    name = f"projects/aikaapp-584fa/secrets/{secret_id}/versions/latest"
    response = client.access_secret_version(request={"name": name})
    return response.payload.data.decode("UTF-8")

LINE_CHANNEL_ACCESS_TOKEN = get_secret("line-access-token")
DIFY_API_KEY = get_secret("dify-api-key")
```

---

## 📊 セキュリティチェックリスト

### 実装済み ✅
- [x] レートリミット（ユーザーごと）
- [x] Firebase Storageセキュリティルール
- [x] ファイルサイズ制限（100MB）
- [x] ファイル形式制限（動画のみ）
- [x] 機密情報のサーバーサイド管理
- [x] HTTPS強制（Netlify自動）
- [x] エラーハンドリング

### 推奨（次のステップ）
- [ ] GCP請求アラート設定
- [ ] ログ監視とアラート
- [ ] Secret Manager導入
- [ ] 定期的なAPIキーローテーション

### オプション（将来的に）
- [ ] Cloudflare導入
- [ ] セキュリティ診断の実施
- [ ] ペネトレーションテスト

---

## 🔍 定期的な確認事項

1. **月1回:**
   - GCP請求を確認
   - 異常なコスト増加がないか確認
   - Firestoreのレートリミットデータをクリーンアップ（自動）

2. **四半期ごと:**
   - APIキーのローテーション検討
   - セキュリティルールの見直し
   - 依存関係の更新（`requirements.txt`）

---

## 🆘 セキュリティインシデント発生時

1. **即座の対応:**
   - 影響を受けたAPIキーを無効化
   - Firebase Consoleで異常なアクセスを確認
   - Cloud Functionsのログを確認

2. **報告:**
   - 異常なアクセスパターンを記録
   - 必要に応じてFirebaseサポートに連絡

---

## 📚 参考資料

- [Firebase Security Rules ドキュメント](https://firebase.google.com/docs/rules)
- [GCP 予算とアラート](https://cloud.google.com/billing/docs/how-to/budgets)
- [Firebase Functions セキュリティ](https://firebase.google.com/docs/functions/security)

---

**最終更新:** 2025-01-XX
**作成者:** AI Assistant（Auto）

