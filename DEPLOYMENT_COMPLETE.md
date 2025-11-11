# ✅ デプロイ完了レポート

## 📋 デプロイされた関数

### 1. ✅ lineWebhookRouter (Node.js)
- **URL**: https://linewebhookrouter-kvuv4ufotq-an.a.run.app
- **機能**: LINE Webhookのルーター関数（動画メッセージとテキストメッセージを処理）
- **状態**: ✅ デプロイ完了

### 2. ✅ processVideoJob (Node.js)
- **URL**: https://processvideojob-kvuv4ufotq-an.a.run.app
- **機能**: 動画解析ジョブの処理関数
- **状態**: ✅ デプロイ完了

### 3. ⚠️ process_video_trigger (Python) - 未デプロイ
- **状態**: ⚠️ 今回のデプロイには含まれていません
- **デプロイ方法**: 以下のいずれかが必要です

---

## 🔧 次のステップ

### ステップ1: LINE Webhook URLを更新

**LINE Developers Consoleでの設定手順**:

1. [LINE Developers Console](https://developers.line.biz/console/)にアクセス
2. 該当するチャネルを選択
3. 「Messaging API」タブを開く
4. 「Webhook URL」セクションで以下を設定:
   - **Webhook URL**: `https://linewebhookrouter-kvuv4ufotq-an.a.run.app`
5. 「Webhookの利用」を「利用する」に設定
6. 「検証」ボタンをクリックして、Webhook URLが正しく動作するか確認
7. 「更新」ボタンをクリックして保存

**確認項目**:
- ✅ Webhook URLが正しく設定されているか
- ✅ Webhookの利用が「利用する」になっているか
- ✅ 検証が成功しているか

---

### ステップ2: Python関数（process_video_trigger）のデプロイ（オプション）

**注意**: この関数は、Firebase Storageに動画がアップロードされた際に自動的にトリガーされる関数です。現在の実装では、LINE Webhook経由で動画を処理しているため、この関数が必須ではありません。

**デプロイが必要な場合**:

#### 方法1: gcloudコマンドで直接デプロイ

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

#### 方法2: Firebase Consoleから手動で設定

1. [Firebase Console](https://console.firebase.google.com/)にアクセス
2. プロジェクトを選択
3. 「Storage」→「トリガー」タブを開く
4. `process_video_trigger`関数をStorageイベントに紐付け
5. 設定を保存

**確認項目**:
- ✅ Storageトリガーが正しく設定されているか
- ✅ パスパターンが`videos/**`になっているか
- ✅ イベントタイプが`google.storage.object.finalize`になっているか

---

### ステップ3: 動作確認

#### 3-1. リッチメニューからの動画アップロード

**確認手順**:
1. LINEアプリで、リッチメニューから動画をアップロード
2. 動画が正常にアップロードされるか確認
3. 解析結果が返ってくるか確認
4. 解析結果に英語が含まれているか確認

**期待される動作**:
- ✅ 動画がアップロードされる
- ✅ 解析結果が返ってくる（日本語と英語の両方）
- ✅ エラーメッセージが表示されない

**トラブルシューティング**:
- 動画がアップロードされない場合:
  - LINE Webhook URLが正しく設定されているか確認
  - LINE Developers ConsoleでWebhookの検証を実行
- 解析結果が返ってこない場合:
  - Cloud Functionsのログを確認
  - Dify APIキーが正しく設定されているか確認

---

#### 3-2. テキストメッセージで会話ができるか確認

**確認手順**:
1. LINEアプリで、テキストメッセージを送信
2. AIKA19号の返信が返ってくるか確認
3. 会話の継続性が保たれるか確認（複数のメッセージを送信して確認）
4. 返信に英語が含まれているか確認

**期待される動作**:
- ✅ AIKA19号の返信が返ってくる
- ✅ 会話の文脈が保たれる（前の会話を覚えている）
- ✅ 返信に英語が含まれている

**トラブルシューティング**:
- 返信が返ってこない場合:
  - Cloud Functionsのログを確認
  - Dify APIキーが正しく設定されているか確認
  - Firestoreの`user_conversations`コレクションに会話IDが保存されているか確認
- 会話の継続性が保たれない場合:
  - Firestoreの`user_conversations`コレクションを確認
  - 会話IDが正しく保存されているか確認

---

#### 3-3. 解析結果に英語が含まれているか確認

**確認手順**:
1. 動画をアップロードして解析結果を確認
2. 解析結果に英語が含まれているか確認
3. テキストメッセージの返信に英語が含まれているか確認

**期待される動作**:
- ✅ 動画解析結果に英語が含まれている
- ✅ テキストメッセージの返信に英語が含まれている
- ✅ Difyが既に英語を含んでいる場合は、そのまま使用される

**トラブルシューティング**:
- 英語が含まれていない場合:
  - Difyのワークフロー設定を確認
  - システムプロンプトに「日本語と英語の両方で返信してください」という指示が含まれているか確認

---

## 🔍 ログの確認方法

### Cloud Functionsのログを確認

```bash
# lineWebhookRouterのログを確認
gcloud functions logs read lineWebhookRouter --region=asia-northeast1 --limit=50

# processVideoJobのログを確認
gcloud functions logs read processVideoJob --region=asia-northeast1 --limit=50
```

### Firebase Consoleからログを確認

1. [Firebase Console](https://console.firebase.google.com/)にアクセス
2. プロジェクトを選択
3. 「Functions」→「ログ」タブを開く
4. 該当する関数のログを確認

---

## ✅ チェックリスト

### デプロイ確認
- [x] lineWebhookRouterがデプロイされている
- [x] processVideoJobがデプロイされている
- [ ] process_video_triggerがデプロイされている（オプション）

### LINE Webhook設定
- [ ] LINE Webhook URLが正しく設定されている
- [ ] Webhookの利用が「利用する」になっている
- [ ] Webhookの検証が成功している

### 動作確認
- [ ] リッチメニューから動画をアップロードして解析される
- [ ] テキストメッセージで会話ができる
- [ ] 解析結果に英語が含まれている
- [ ] 会話の継続性が保たれる

### エラーハンドリング
- [ ] エラー時に適切なメッセージが返る
- [ ] エラーメッセージが日本語と英語の両方で表示される

---

## 📝 注意事項

### 1. Difyの設定
- Difyのワークフローで日本語と英語の両方を返すように設定すると、翻訳API呼び出しが不要になり、パフォーマンスが向上します
- システムプロンプトに「日本語と英語の両方で返信してください」という指示を追加することを推奨します

### 2. 環境変数の確認
- `DIFY_API_KEY`が正しく設定されているか確認
- `LINE_CHANNEL_ACCESS_TOKEN`が正しく設定されているか確認
- `LINE_CHANNEL_SECRET`が正しく設定されているか確認

### 3. Firestoreの設定
- `user_conversations`コレクションが正しく作成されるか確認
- 会話IDが正しく保存されるか確認

---

## 🚀 次のアクション

1. **LINE Webhook URLを更新**（必須）
   - LINE Developers Consoleで、Webhook URLを`https://linewebhookrouter-kvuv4ufotq-an.a.run.app`に設定

2. **動作確認を実行**（必須）
   - リッチメニューから動画をアップロードして解析されるか確認
   - テキストメッセージで会話ができるか確認
   - 解析結果に英語が含まれているか確認

3. **Difyワークフローの設定**（推奨）
   - システムプロンプトに「日本語と英語の両方で返信してください」という指示を追加

4. **Python関数のデプロイ**（オプション）
   - Storageトリガーが必要な場合のみ、`process_video_trigger`をデプロイ

---

**最終更新**: 2025-01-XX
**状態**: ✅ デプロイ完了、動作確認待ち
