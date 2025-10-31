# 🔥 Firebase Functionsデプロイ手順（完成版）

## ✅ 準備完了チェックリスト

- ✅ Dify API Key: `app-6OBnNxu0oWUiMVVq0rjepVhJ`
- ✅ LINE Channel Access Token: 取得済み
- ✅ Firebase CLI: インストール済み（v14.22.0）
- ✅ コード: 完成済み
- ✅ firebase.json: 設定済み

---

## 📋 ステップ1: Firebaseにログイン

```bash
cd "/Users/jin/Library/CloudStorage/Dropbox/NEW WORLD/1101 new"
firebase login
```

ブラウザでGoogleアカウントにログイン

---

## 📋 ステップ2: プロジェクトを確認

```bash
firebase use aikaapp-584fa
```

確認：
```bash
firebase projects:list
```

---

## 📋 ステップ3: 環境変数を設定（重要！）

### Firebase Consoleで設定（推奨）

1. **Firebase Consoleにアクセス**
   - https://console.firebase.google.com/project/aikaapp-584fa/functions/config

2. **「環境変数を追加」をクリック**

3. **以下を3つ追加：**

| キー | 値 |
|------|-----|
| `DIFY_API_ENDPOINT` | `https://api.dify.ai/v1/chat-messages` |
| `DIFY_API_KEY` | `app-6OBnNxu0oWUiMVVq0rjepVhJ` |
| `LINE_CHANNEL_ACCESS_TOKEN` | `dmEAWqyaDSsjpiTT4+i7YUD9I+nW2SV7O+i1XbjvIDMvbRP3CrJBG9kqGH34fZ98cQVfw9ldezkWUqlgLMBB1MtN1z2J/I2efQVA1grXYoz30SbK1DVVlzKu5PqEL91Px1FHoqUkzxPnTeAwoWWmlwdB04t89/1O/w1cDnyilFU=` |

**⚠️ 重要**: 環境変数を設定してからデプロイしてください

---

## 📋 ステップ4: Functionsを初期化（初回のみ）

```bash
firebase init functions
```

**選択肢：**
- ❓ Functionsを設定しますか？ → **Yes**
- ❓ 既存のプロジェクトを使用 → **aikaapp-584fa**
- ❓ 言語 → **Python**
- ❓ ESLint → **No**
- ❓ functionsフォルダを上書きしますか？ → **No** （既存のコードがあるため）

---

## 📋 ステップ5: デプロイ実行

```bash
firebase deploy --only functions:process_video_trigger
```

または、すべてのFunctionsをデプロイ：
```bash
firebase deploy --only functions
```

**デプロイ時間：** 約5-15分（初回は長め）

---

## 📋 ステップ6: Storageトリガーを設定

### 方法1: Firebase Console（簡単）

1. Firebase Console → Storage → ルール
2. トリガータブ
3. 新しいトリガーを作成：
   - 関数: `process_video_trigger`
   - イベントタイプ: `google.storage.object.finalize`
   - バケット: `aikaapp-584fa.appspot.com`
   - プレフィックス: `videos/`

### 方法2: gcloudコマンド

```bash
gcloud functions deploy process_video_trigger \
  --gen2 \
  --runtime=python312 \
  --region=asia-northeast1 \
  --source=functions \
  --entry-point=process_video_trigger \
  --trigger-bucket=aikaapp-584fa.appspot.com \
  --trigger-event-filters=type=google.storage.object.finalize \
  --trigger-event-filters-path-pattern=videos/**
```

---

## ✅ 完了確認

デプロイ後、以下を確認：

1. **Functions一覧**
   ```bash
   firebase functions:list
   ```

2. **ログ確認**
   - Firebase Console → Functions → ログ

3. **テスト実行**
   - LIFFアプリで動画をアップロード
   - Functionsのログで実行状況を確認
   - LINEでメッセージが届くことを確認

---

## 🐛 トラブルシューティング

### エラー: "ModuleNotFoundError"
→ `requirements.txt`のライブラリがインストールされていない
→ デプロイ時に自動でインストールされます

### エラー: "Environment variable not found"
→ Firebase Consoleで環境変数を再確認

### エラー: "Trigger not working"
→ Storageトリガーの設定を確認

### デプロイが遅い
→ 初回デプロイは時間がかかります（5-15分）
→ 2回目以降は速くなります

