# 🔧 Firebase Storage CORS設定ガイド

## ❌ エラー: CORS Policy Blocking

```
Access to XMLHttpRequest at 'https://firebasestorage.googleapis.com/...' 
from origin 'https://aika18.netlify.app' 
has been blocked by CORS policy: 
Response to preflight request doesn't pass access control check: 
It does not have HTTP ok status.
```

---

## ✅ 解決方法

### ステップ1: Firebase StorageのCORS設定を確認・設定

Firebase Storageは、デフォルトではCORSを許可していません。Google Cloud Storage（GCS）のCORS設定が必要です。

#### 方法1: gcloudコマンドで設定（推奨）

```bash
# 1. gcloud CLIをインストール（未インストールの場合）
# https://cloud.google.com/sdk/docs/install

# 2. プロジェクトを設定
gcloud config set project aikaapp-584fa

# 3. CORS設定ファイルを作成
cat > cors.json << 'EOF'
[
  {
    "origin": ["https://aika18.netlify.app", "https://*.netlify.app", "http://localhost:*"],
    "method": ["GET", "POST", "PUT", "DELETE", "HEAD"],
    "responseHeader": ["Content-Type", "Authorization"],
    "maxAgeSeconds": 3600
  }
]
EOF

# 4. CORS設定を適用
gsutil cors set cors.json gs://aikaapp-584fa.appspot.com

# 5. 設定を確認
gsutil cors get gs://aikaapp-584fa.appspot.com
```

#### 方法2: Google Cloud Consoleから設定

1. **Google Cloud Consoleにアクセス**
   - https://console.cloud.google.com/storage/browser/aikaapp-584fa.appspot.com

2. **バケットを選択**
   - `aikaapp-584fa.appspot.com` をクリック

3. **設定タブを開く**
   - 「設定」タブをクリック

4. **CORS設定を追加**
   - 「CORS構成」セクションを探す
   - 「CORS構成を編集」をクリック
   - 以下のJSONを貼り付け:

```json
[
  {
    "origin": ["https://aika18.netlify.app", "https://*.netlify.app", "http://localhost:*"],
    "method": ["GET", "POST", "PUT", "DELETE", "HEAD"],
    "responseHeader": ["Content-Type", "Authorization"],
    "maxAgeSeconds": 3600
  }
]
```

5. **保存**

---

### ステップ2: Storage Rulesを確認

`storage.rules`ファイルで、認証済みユーザーがアップロードできることを確認してください。

---

### ステップ3: 動作確認

設定後：

1. **ブラウザを再読み込み**
   - シークレットモードで開き直す
   - `https://aika18.netlify.app?dev=true`

2. **動画をアップロード**
   - アップロード進捗が0%から100%まで進行することを確認

3. **コンソールで確認**
   - CORSエラーが表示されなくなることを確認

---

## 🔍 CORS設定の確認方法

設定が正しく適用されているか確認：

```bash
gsutil cors get gs://aikaapp-584fa.appspot.com
```

または、Google Cloud Console → Storage → バケット → 設定 → CORS構成

---

## ⚠️ 注意事項

- CORS設定の変更は即座に反映される場合と、数分かかる場合があります
- 設定後、ブラウザを再読み込みしてください
- 複数のオリジン（Netlify、localhost）を含めることを推奨します

---

**最終更新:** 2025-01-XX  
**状態:** ⚠️ CORS設定が必要






