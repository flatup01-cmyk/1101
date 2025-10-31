# 🚀 最短デプロイガイド

## ✅ 準備完了しているもの

- ✅ LINE Channel Access Token: **取得済み**
- ✅ Cloud Functionsコード: **完成済み**
- ✅ 動画解析ロジック: **完成済み**

## 📋 残りの設定（Dify APIのみ）

### Dify APIキーを取得

1. Dify管理画面にログイン
2. ワークスペース設定 → API Keys
3. 「Create API Key」をクリック
4. APIキーをコピー

### Dify APIエンドポイント

通常は以下：
```
https://api.dify.ai/v1/chat-messages
```

または、Difyのワークスペース設定で確認

## 🔧 Firebase Consoleで環境変数を設定

### ステップ1: Firebase Consoleにアクセス

https://console.firebase.google.com/project/aikaapp-584fa/functions

### ステップ2: 環境変数を追加

「環境変数を追加」をクリックして、以下を設定：

| キー | 値 |
|------|-----|
| `DIFY_API_ENDPOINT` | `https://api.dify.ai/v1/chat-messages` |
| `DIFY_API_KEY` | `app-6OBnNxu0oWUiMVVq0rjepVhJ` |
| `LINE_CHANNEL_ACCESS_TOKEN` | `dmEAWqyaDSsjpiTT4+i7YUD9I+nW2SV7O+i1XbjvIDMvbRP3CrJBG9kqGH34fZ98cQVfw9ldezkWUqlgLMBB1MtN1z2J/I2efQVA1grXYoz30SbK1DVVlzKu5PqEL91Px1FHoqUkzxPnTeAwoWWmlwdB04t89/1O/w1cDnyilFU=` |

### ステップ3: デプロイ

```bash
cd "/Users/jin/Library/CloudStorage/Dropbox/NEW WORLD/1101 new"
firebase deploy --only functions
```

## ✅ 完了！

デプロイ後：
1. LIFFアプリで動画をアップロード
2. Firebase Storageに保存される
3. Cloud Functionsが自動実行
4. 数分後にLINEでAIKAからのメッセージが届く ✨

