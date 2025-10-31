# Cloud Functions環境変数設定

## 必要な環境変数（3つ）

### 1. Dify API設定

**DIFY_API_ENDPOINT**
```
https://api.dify.ai/v1/chat-messages
```
または、あなたのDifyワークスペースのエンドポイント

**DIFY_API_KEY**
```
app-6OBnNxu0oWUiMVVq0rjepVhJ
```

### 2. LINE Messaging API設定

**LINE_CHANNEL_ACCESS_TOKEN**
```
dmEAWqyaDSsjpiTT4+i7YUD9I+nW2SV7O+i1XbjvIDMvbRP3CrJBG9kqGH34fZ98cQVfw9ldezkWUqlgLMBB1MtN1z2J/I2efQVA1grXYoz30SbK1DVVlzKu5PqEL91Px1FHoqUkzxPnTeAwoWWmlwdB04t89/1O/w1cDnyilFU=
```

## 🔐 設定方法

### 方法1: Firebase Console（簡単）

1. Firebase Consoleにアクセス
   - https://console.firebase.google.com/
   - プロジェクト: `aikaapp-584fa`

2. Functions → 環境変数
   - 「環境変数を追加」をクリック

3. 以下の3つを追加：
   - `DIFY_API_ENDPOINT` = `https://api.dify.ai/v1/chat-messages`
   - `DIFY_API_KEY` = （Difyから取得）
   - `LINE_CHANNEL_ACCESS_TOKEN` = （上記のトークン）

### 方法2: Firebase CLI（コマンドライン）

```bash
firebase functions:config:set \
  dify.api_endpoint="https://api.dify.ai/v1/chat-messages" \
  dify.api_key="your_dify_api_key" \
  line.channel_access_token="dmEAWqyaDSsjpiTT4+i7YUD9I+nW2SV7O+i1XbjvIDMvbRP3CrJBG9kqGH34fZ98cQVfw9ldezkWUqlgLMBB1MtN1z2J/I2efQVA1grXYoz30SbK1DVVlzKu5PqEL91Px1FHoqUkzxPnTeAwoWWmlwdB04t89/1O/w1cDnyilFU="
```

### 方法3: Secret Manager（推奨・本番環境）

機密情報はSecret Managerに保存することを推奨：

```bash
# LINE Access Tokenを登録
echo -n "dmEAWqyaDSsjpiTT4+i7YUD9I+nW2SV7O+i1XbjvIDMvbRP3CrJBG9kqGH34fZ98cQVfw9ldezkWUqlgLMBB1MtN1z2J/I2efQVA1grXYoz30SbK1DVVlzKu5PqEL91Px1FHoqUkzxPnTeAwoWWmlwdB04t89/1O/w1cDnyilFU=" | \
  gcloud secrets create line-access-token --data-file=- --project=aikaapp-584fa
```

## ⚠️ セキュリティ注意事項

- ✅ 環境変数は暗号化されて保存されます
- ✅ Secret Managerを使用する場合、より安全です
- ❌ コードに直接書かないでください
- ❌ GitHubにコミットしないでください

