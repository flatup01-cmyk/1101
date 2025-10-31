# 🚀 デプロイガイド（最短最速版）

## ✅ 完成したもの

- ✅ LIFFアプリ（動画アップロード）
- ✅ Cloud Functions（解析 + Dify + LINE連携）
- ✅ 動画解析ロジック

## 📋 デプロイ前に必要な情報

### 1. Dify API設定

**取得方法：**
1. Difyの管理画面にログイン
2. ワークスペース設定 → API Keys
3. APIキーをコピー
4. APIエンドポイントを確認（通常は `https://api.dify.ai/v1/chat-messages`）

### 2. LINE Messaging API設定

**取得方法：**
1. LINE Developers Console
2. チャネル設定 → Messaging API
3. Channel Access Tokenを発行

## 🛠️ Cloud Functionsデプロイ手順

### ステップ1: Firebase CLIをインストール（初回のみ）

```bash
npm install -g firebase-tools
firebase login
```

### ステップ2: Firebaseプロジェクトを初期化

```bash
cd "/Users/jin/Library/CloudStorage/Dropbox/NEW WORLD/1101 new"
firebase init functions
```

**選択肢：**
- Use an existing project: `aikaapp-584fa`を選択
- Language: Python
- Use ESLint: No

### ステップ3: 環境変数を設定

**方法A: Firebase Console（推奨）**
1. Firebase Console → Functions → 環境変数
2. 以下を追加：
   - `DIFY_API_ENDPOINT`
   - `DIFY_API_KEY`
   - `LINE_CHANNEL_ACCESS_TOKEN`

**方法B: Secret Manager（本番推奨）**
```bash
# Dify APIキーを登録
echo -n "your_dify_api_key" | gcloud secrets create dify-api-key --data-file=-

# LINE Access Tokenを登録
echo -n "your_line_token" | gcloud secrets create line-access-token --data-file=-
```

### ステップ4: Firebase Storageトリガーを設定

`functions/main.py`を以下のように変更：

```python
from google.cloud.functions_v1 import CloudFunctionsServiceClient

# トリガー関数名を指定
@functions_framework.cloud_event
def process_video_trigger(cloud_event):
    data = json.loads(base64.b64decode(cloud_event.data['data']).decode())
    return process_video(data, None)
```

### ステップ5: デプロイ

```bash
firebase deploy --only functions
```

## 🧪 テスト方法

### ローカルテスト

```bash
cd functions
python main.py
```

### 実際の動画でテスト

1. LIFFアプリで動画をアップロード
2. Firebase Storageに保存される
3. Cloud Functionsが自動実行
4. LINEで結果を受け取る

## ⚠️ 注意事項

- **コスト**: 動画解析は計算リソースを消費します
- **タイムアウト**: Cloud Functionsの最大実行時間を設定（推奨: 540秒）
- **メモリ**: 2GB以上を推奨

