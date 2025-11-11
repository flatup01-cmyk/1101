# 🚀 デプロイ後の確認コマンド集

## ⚙️ 事前準備：Firebase CLIのインストール

Firebase CLIがインストールされていない場合、以下のコマンドでインストールできます：

```bash
# npm経由でグローバルインストール（推奨）
npm install -g firebase-tools

# または、npx経由で実行（インストール不要）
npx firebase-tools functions:list
```

**インストール確認:**
```bash
firebase --version
```

---

## 📋 基本確認コマンド

### 1. デプロイされた関数の一覧確認

```bash
cd "/Users/jin/Library/CloudStorage/Dropbox/NEW WORLD/1101 new"

# Firebase CLIがインストールされている場合
firebase functions:list

# Firebase CLIがインストールされていない場合（npx経由）
npx firebase-tools functions:list
```

**期待される出力:**
```
✔  functions[lineWebhookRouter(asia-northeast1)] Successful create operation.
✔  functions[processVideoJob(asia-northeast1)] Successful create operation.
```

---

### 2. 関数のURLを確認

```bash
npx firebase functions:config:get
```

または、Firebase Consoleで確認：
- https://console.firebase.google.com/project/aikaapp-584fa/functions

**関数のURL形式:**
- `lineWebhookRouter`: `https://asia-northeast1-aikaapp-584fa.cloudfunctions.net/lineWebhookRouter`
- `processVideoJob`: `https://asia-northeast1-aikaapp-584fa.cloudfunctions.net/processVideoJob`

---

### 3. 【最重要】リアルタイムログの監視

LINEから動画やメッセージを送受信した際の、関数の動作をリアルタイムで確認できます。エラーが発生した場合、即座に検知できるため、まずこのコマンドを実行しておくことを強く推奨します。

```bash
cd "/Users/jin/Library/CloudStorage/Dropbox/NEW WORLD/1101 new"

# すべての関数のログをリアルタイムで監視（推奨）
firebase functions:log
# または
npx firebase-tools functions:log

# 特定の関数のみ監視
firebase functions:log --only lineWebhookRouter
# または
npx firebase-tools functions:log --only lineWebhookRouter

# 最新の50件のログを表示
firebase functions:log --limit 50
# または
npx firebase-tools functions:log --limit 50

# エラーのみ表示（直近のエラーログだけを素早く確認）
firebase functions:log --only errors --limit 20
# または
npx firebase-tools functions:log --only errors --limit 20
```

**使い方:** このコマンドを実行したまま、LINEアプリから操作を行ってください。リアルタイムでログが表示されます。

---

### 4. ログの詳細確認（GCP Console）

```bash
# GCP Consoleでログを開く
open "https://console.cloud.google.com/logs/query?project=aikaapp-584fa&resource=cloud_function"
```

または、Firebase Consoleから：
- https://console.firebase.google.com/project/aikaapp-584fa/functions/logs

---

## 🧪 動作確認コマンド

### 5. LINE Webhookの動作確認（テスト用）

LINEからのリクエストを模したテストデータを curl コマンドで直接Webhook URLに送信し、関数が最低限のリクエストを処理できるかを確認します。

```bash
# WebhookエンドポイントのURLを設定
WEBHOOK_URL="https://asia-northeast1-aikaapp-584fa.cloudfunctions.net/lineWebhookRouter"

# テスト用のPOSTリクエストを送信
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "events": [{
      "type": "message",
      "replyToken": "00000000000000000000000000000000",
      "source": {"userId": "test-user-id", "type": "user"},
      "timestamp": 1614936000000,
      "mode": "active",
      "message": {"type": "text", "id": "test-message-id", "text": "Hello, world"}
    }]
  }'
```

**期待される応答:** `OK` (HTTP 200)

**注意:** このテストでは実際の返信はできませんが、ログに関数の起動記録が残ることで、URLが有効であることの確認ができます。

---

### 6. processVideoJobの動作確認

```bash
# processVideoJobエンドポイントのURL
JOB_URL="https://asia-northeast1-aikaapp-584fa.cloudfunctions.net/processVideoJob"

# テストリクエスト（実際のvideoUrlが必要）
curl -X POST "$JOB_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "test-job-123",
    "lineUserId": "test-user-id",
    "videoUrl": "https://example.com/test-video.mp4"
  }'
```

---

## 📊 監視・デバッグコマンド

### 7. 関数の実行状況を確認

```bash
# 最近の実行履歴を確認
gcloud functions list --project=aikaapp-584fa --region=asia-northeast1

# 特定の関数の詳細情報
gcloud functions describe lineWebhookRouter \
  --project=aikaapp-584fa \
  --region=asia-northeast1 \
  --gen2
```

---

### 8. 環境変数（Secrets）の確認

```bash
# Firebase Secretsの一覧確認
firebase functions:secrets:access

# 特定のSecretの確認（値は表示されない）
gcloud secrets list --project=aikaapp-584fa
```

**設定されているSecrets:**
- `MAKE_WEBHOOK_URL`
- `LINE_CHANNEL_ACCESS_TOKEN`
- `PROCESS_VIDEO_JOB_URL`
- `DIFY_API_KEY`

---

### 9. エラーログの検索

```bash
# エラーログのみを検索（過去1時間）
gcloud logging read \
  "resource.type=cloud_function AND severity>=ERROR" \
  --project=aikaapp-584fa \
  --limit=50 \
  --format=json

# 特定の関数のエラーのみ
gcloud logging read \
  "resource.type=cloud_function AND resource.labels.function_name=lineWebhookRouter AND severity>=ERROR" \
  --project=aikaapp-584fa \
  --limit=20
```

---

### 10. 関数のメトリクス確認

```bash
# 関数の実行回数、エラー率などを確認
gcloud monitoring time-series list \
  --project=aikaapp-584fa \
  --filter='metric.type="cloudfunctions.googleapis.com/function/execution_count"'
```

または、Firebase Consoleで確認：
- https://console.firebase.google.com/project/aikaapp-584fa/functions/usage

---

## 🔄 再デプロイ・更新コマンド

### 11. 特定の関数のみ再デプロイ

```bash
cd "/Users/jin/Library/CloudStorage/Dropbox/NEW WORLD/1101 new"

# lineWebhookRouterのみ再デプロイ
npx firebase deploy --only functions:lineWebhookRouter

# processVideoJobのみ再デプロイ
npx firebase deploy --only functions:processVideoJob
```

---

### 12. 関数の削除（必要に応じて）

```bash
# 特定の関数を削除
npx firebase functions:delete lineWebhookRouter --region=asia-northeast1

# 確認プロンプトなしで削除
npx firebase functions:delete lineWebhookRouter --region=asia-northeast1 --force
```

---

## 🚨 トラブルシューティング用コマンド

### 13. 関数の状態確認

```bash
# すべての関数の状態を確認
gcloud functions list \
  --project=aikaapp-584fa \
  --region=asia-northeast1 \
  --gen2 \
  --format="table(name,state,updateTime)"
```

---

### 14. タイムアウトやメモリ設定の確認

```bash
# 関数の設定を確認
gcloud functions describe lineWebhookRouter \
  --project=aikaapp-584fa \
  --region=asia-northeast1 \
  --gen2 \
  --format=yaml | grep -E "timeout|availableMemory"
```

---

### 15. ログのエクスポート（詳細分析用）

```bash
# ログをファイルにエクスポート
gcloud logging read \
  "resource.type=cloud_function AND resource.labels.function_name=lineWebhookRouter" \
  --project=aikaapp-584fa \
  --limit=1000 \
  --format=json > lineWebhookRouter_logs.json
```

---

## 📝 よく使うコマンドのショートカット

### ログをリアルタイムで監視（最も使用頻度が高い・推奨）

```bash
cd "/Users/jin/Library/CloudStorage/Dropbox/NEW WORLD/1101 new"

# Firebase CLIがインストールされている場合
firebase functions:log

# Firebase CLIがインストールされていない場合
npx firebase-tools functions:log
```

**使い方:** このコマンドを実行したまま、LINEアプリから操作を行ってください。リアルタイムでログが表示されます。

### 最新のエラーのみ確認

```bash
cd "/Users/jin/Library/CloudStorage/Dropbox/NEW WORLD/1101 new"

# Firebase CLIがインストールされている場合
firebase functions:log --only errors --limit 20

# Firebase CLIがインストールされていない場合
npx firebase-tools functions:log --only errors --limit 20
```

### 関数の一覧とURL確認

```bash
cd "/Users/jin/Library/CloudStorage/Dropbox/NEW WORLD/1101 new"

# Firebase CLIがインストールされている場合
firebase functions:list

# Firebase CLIがインストールされていない場合
npx firebase-tools functions:list
```

---

## ✅ デプロイ成功の確認チェックリスト

- [ ] `npx firebase functions:list` で2つの関数が表示される
- [ ] Firebase Consoleで関数が「アクティブ」状態になっている
- [ ] `npx firebase functions:log` でログにエラーが表示されていない
- [ ] LINE Webhookのテストリクエストが `OK` を返す
- [ ] 環境変数（Secrets）が正しく設定されている

## 🚀 推奨する次のアクション

**まずは コマンド3のリアルタイムログ監視 を実行し、その状態でLINE公式アカウントに動画を送って、期待通りのログが出力されるかを確認してください。**

```bash
cd "/Users/jin/Library/CloudStorage/Dropbox/NEW WORLD/1101 new"

# Firebase CLIがインストールされている場合
firebase functions:log

# Firebase CLIがインストールされていない場合
npx firebase-tools functions:log
```

このコマンドを実行したまま、LINEアプリから操作を行ってください。もしエラーが発生しても、その内容を即座に把握できます。

---

## 🔗 便利なリンク

- **Firebase Console (Functions)**: https://console.firebase.google.com/project/aikaapp-584fa/functions
- **Firebase Console (Logs)**: https://console.firebase.google.com/project/aikaapp-584fa/functions/logs
- **GCP Console (Logs)**: https://console.cloud.google.com/logs/query?project=aikaapp-584fa
- **GCP Console (Functions)**: https://console.cloud.google.com/functions/list?project=aikaapp-584fa

