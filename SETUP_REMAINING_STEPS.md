# 🔧 残りの設定作業ガイド

## 📊 現在の実装状況

### ✅ 完了している部分

1. **フロントエンド（LIFFアプリ）**
   - ✅ 動画アップロード機能
   - ✅ Firebase認証
   - ✅ UI（AIKA18号のツンデレ表示）

2. **バックエンド（Cloud Functions）**
   - ✅ 動画解析処理（MediaPipe）
   - ✅ Dify API連携コード
   - ✅ LINE API連携コード
   - ✅ エラーハンドリング
   - ✅ レートリミット機能

### ⚠️ 設定が必要な部分

1. **Cloud Functionsのデプロイ** ← **重要！**
2. **Firebase Storageトリガーの設定** ← **重要！**
3. **環境変数の設定（Firebase）**
4. **Dify APIワークフローの設定**

---

## 📋 ステップ1: Cloud Functionsをデプロイ

### 1-1. Firebase CLIでログイン確認

```bash
cd "/Users/jin/Library/CloudStorage/Dropbox/NEW WORLD/1101 new"
firebase login
```

### 1-2. Functionsをデプロイ

```bash
firebase deploy --only functions
```

**デプロイ時間**: 約5-15分（初回は長め）

**デプロイされる関数**:
- `process_video_trigger` - 動画解析処理

---

## 📋 ステップ2: Firebase Storageトリガーを設定

Firebase Storageにファイルがアップロードされると、自動でCloud Functionが呼ばれるように設定します。

### 方法A: Firebase Consoleで設定（推奨・簡単）

1. **Firebase Consoleにアクセス**
   - https://console.firebase.google.com/project/aikaapp-584fa/functions

2. **「process_video_trigger」を探す**
   - Functions一覧に表示されているはず

3. **「トリガーを追加」をクリック**
   - または、関数の詳細画面から「トリガー」タブを開く

4. **トリガー設定**:
   - **イベントタイプ**: `google.storage.object.finalize`
   - **バケット**: `aikaapp-584fa.firebasestorage.app`
   - **プレフィックス**: `videos/`
   - **保存**

### 方法B: gcloudコマンドで設定

```bash
gcloud functions deploy process_video_trigger \
  --gen2 \
  --runtime=python312 \
  --region=asia-northeast1 \
  --source=functions \
  --entry-point=process_video_trigger \
  --trigger-bucket=aikaapp-584fa.firebasestorage.app \
  --trigger-event-filters=type=google.storage.object.finalize \
  --trigger-event-filters-path-pattern=videos/**
```

---

## 📋 ステップ3: 環境変数を設定（Firebase）

### 3-1. Firebase Consoleで環境変数を設定

1. **Firebase Consoleにアクセス**
   - https://console.firebase.google.com/project/aikaapp-584fa/functions

2. **「process_video_trigger」を選択**
   - → 「設定」タブ → 「環境変数」セクション

3. **以下の環境変数を追加**:

| 変数名 | 値 | 説明 |
|--------|-----|------|
| `DIFY_API_ENDPOINT` | `https://api.dify.ai/v1/chat-messages` | Dify APIのエンドポイント |
| `DIFY_API_KEY` | `app-6OBnNxu0oWUiMVVq0rjepVhJ` | Dify APIキー（提供済み） |
| `LINE_CHANNEL_ACCESS_TOKEN` | `dmEAWqyaDSsjpiTT4...` | LINE Messaging APIのアクセストークン（提供済み） |

### 3-2. コマンドで設定（オプション）

```bash
firebase functions:config:set \
  dify.api_endpoint="https://api.dify.ai/v1/chat-messages" \
  dify.api_key="app-6OBnNxu0oWUiMVVq0rjepVhJ" \
  line.channel_access_token="dmEAWqyaDSsjpiTT4+i7YUD9I+nW2SV7O+i1XbjvIDMvbRP3CrJBG9kqGH34fZ98cQVfw9ldezkWUqlgLMBB1MtN1z2J/I2efQVA1grXYoz30SbK1DVVlzKu5PqEL91Px1HqUkzxPnTeAwoWWmlwdB04t89/1O/w1cDnyilFU="
```

**注意**: Functions Gen2の場合、環境変数の設定方法が異なる場合があります。

---

## 📋 ステップ4: Dify APIワークフローの確認

### 4-1. Dify APIエンドポイントの確認

提供された情報:
- **API Endpoint**: `https://api.dify.ai/v1/chat-messages`
- **API Key**: `app-6OBnNxu0oWUiMVVq0rjepVhJ`

### 4-2. Difyワークフローの確認

1. **Dify Studioにアクセス**
   - https://dify.ai

2. **ワークフローを確認**
   - プロンプトに「AIKA18号」のツンデレ設定があるか確認
   - 入力変数に以下が設定されているか確認:
     - `punch_speed_score`
     - `guard_stability_score`
     - `kick_height_score`
     - `core_rotation_score`

---

## ✅ 動作確認

### 1. LIFFアプリで動画をアップロード

1. `https://aika18.netlify.app?dev=true` を開く
2. 動画を選択して「🚀 解析開始」
3. アップロードが完了することを確認

### 2. Firebase Consoleでログを確認

1. **Firebase Console → Functions → ログ**
   - https://console.firebase.google.com/project/aikaapp-584fa/functions/logs

2. **以下が表示されることを確認**:
   ```
   処理開始: videos/{userId}/{filename}
   ✓ レートリミットチェック通過: {userId}
   ダウンロード完了: {temp_path}
   解析結果: {...}
   Dify API成功: ...
   ✅ LINEメッセージ送信成功
   ```

### 3. LINEでメッセージを確認

- 数分後にLINEでAIKA18号からのメッセージが届く
- 解析結果とスコアが表示される

---

## 🐛 トラブルシューティング

### エラー: "Functions not deployed"

→ `firebase deploy --only functions` を実行

### エラー: "Trigger not working"

→ Firebase ConsoleでStorageトリガーを再確認

### エラー: "Environment variable not found"

→ Firebase Consoleで環境変数を再確認

### エラー: "Dify API error"

→ Dify Studioでワークフローを確認

---

**最終更新**: 2025-11-01  
**状態**: 設定作業が必要


