# 📋 AIKA19号 実装・検証 クイックリファレンス

## 🎯 実装済み機能（確認済み）

### ✅ 1. リッチメニューからの動画アップロード
- LINE Webhookで動画メッセージを検知・処理
- リッチメニュー経由でも通常メッセージとして処理可能
- 動画IDとソースタイプをログ出力

### ✅ 2. 解析結果に英語を追加
- `functions/dify/handler.js`で実装
- Difyが英語を含む場合はそのまま使用
- 英語がない場合は簡易的な英語版を追加
- 翻訳エラー時は日本語のみ送信

### ✅ 3. テキストメッセージをDifyで処理
- `functions/dify/chat.js`で実装
- 即時受付メッセージを送信（日本語・英語）
- Firestoreに会話IDを保存（会話の継続性）
- エラー時はフォールバックメッセージを送信

---

## 🔧 修正が必要な場合の指示

### 修正1: テキストメッセージの即時受付返信が動作しない

**指示**:
```
functions/index.jsの165-193行目を確認。
テキストメッセージ受信時に即時受付メッセージが送信されているか確認。
送信されていない場合は、acceptMessageを送信するコードを追加。
```

**確認ポイント**:
- `event.replyToken`が存在するか
- `lineClient.replyMessage`または`pushMessage`が呼ばれているか
- エラーログに「テキストメッセージ受付完了メッセージ」が出力されているか

---

### 修正2: 動画受信時のソースタイプがログ出力されない

**指示**:
```
functions/index.jsの74-80行目を確認。
動画受信時にソースタイプ、ユーザーID、リッチメニュー由来かどうかをログ出力するコードがあるか確認。
ない場合は追加。
```

**確認ポイント**:
- `console.info`でソースタイプが出力されているか
- `event.source?.type`が取得できているか

---

### 修正3: 解析結果に英語が含まれない

**指示**:
```
functions/dify/handler.jsの128-151行目を確認。
Difyの回答に英語が含まれているかチェックし、含まれていない場合は追加するコードがあるか確認。
```

**確認ポイント**:
- `answerJp.includes('[English]')`のチェックがあるか
- 英語がない場合のフォールバック処理があるか

---

### 修正4: 会話の継続性が保たれない

**指示**:
```
functions/dify/chat.jsの37-93行目を確認。
Firestoreから会話IDを取得し、保存するコードがあるか確認。
```

**確認ポイント**:
- `userConversationsRef.get()`で会話IDを取得しているか
- `userConversationsRef.set()`で会話IDを保存しているか
- `conversation_id`がDify APIに渡されているか

---

## 🚀 デプロイ後の動作確認チェックリスト

### A. LINE Webhook
- [ ] Webhook URLが正しく設定されている
- [ ] テキスト受信時に「受付メッセージ」が即時返信される
- [ ] 動画受信時に「動画ID・ソースタイプ」がログ出力される

### B. リッチメニュー経由の動画
- [ ] リッチメニューからの動画が処理される
- [ ] 解析結果が日本語→英語の順で返る

### C. テキスト会話
- [ ] AIKA19号の返信が返ってくる
- [ ] 連続送信で会話の継続性が保たれる

---

## 📊 ログ確認コマンド

```bash
# lineWebhookRouterのログ
gcloud functions logs read lineWebhookRouter --region=asia-northeast1 --limit=50

# processVideoJobのログ
gcloud functions logs read processVideoJob --region=asia-northeast1 --limit=50
```

---

## 🔍 トラブルシューティング

### 問題1: テキストメッセージが返ってこない

**確認**:
1. `functions/index.js`で`handleTextChat`が呼ばれているか
2. `functions/dify/chat.js`でDify APIが呼ばれているか
3. Firestoreの`user_conversations`コレクションに会話IDが保存されているか

**修正指示**:
```
functions/index.jsの195-201行目を確認。
handleTextChatが正しく呼ばれているか確認。
エラーハンドリングが適切か確認。
```

---

### 問題2: 動画解析結果が返ってこない

**確認**:
1. `functions/index.js`で`processVideoJob`が呼ばれているか
2. `functions/dify/handler.js`でDify APIが呼ばれているか
3. 動画URLが正しく生成されているか

**修正指示**:
```
functions/index.jsの140-145行目を確認。
processVideoJobへのリクエストが正しく送信されているか確認。
functions/dify/handler.jsの109-123行目を確認。
Dify APIの呼び出しが成功しているか確認。
```

---

### 問題3: 会話の継続性が保たれない

**確認**:
1. Firestoreの`user_conversations`コレクションに会話IDが保存されているか
2. 次回のメッセージで会話IDが取得されているか

**修正指示**:
```
functions/dify/chat.jsの37-50行目を確認。
Firestoreから会話IDを取得するコードが正しく動作しているか確認。
87-93行目を確認。
会話IDを保存するコードが正しく動作しているか確認。
```

---

## 📝 環境変数チェックリスト

### lineWebhookRouter
- [ ] `MAKE_WEBHOOK_URL`
- [ ] `LINE_CHANNEL_ACCESS_TOKEN`
- [ ] `PROCESS_VIDEO_JOB_URL`
- [ ] `DIFY_API_KEY`
- [ ] `LINE_CHANNEL_SECRET`

### processVideoJob
- [ ] `DIFY_API_KEY`
- [ ] `LINE_CHANNEL_ACCESS_TOKEN`

---

## 🎯 よくある修正指示

### 指示1: テキストメッセージの即時受付返信を追加

```
functions/index.jsの165行目以降に、テキストメッセージ受信時に即座に受付メッセージを送信するコードを追加。
動画メッセージ処理（87-107行目）と同様の実装を追加。
```

### 指示2: 動画受信時のソースタイプをログ出力

```
functions/index.jsの74行目に、event.sourceの情報をログ出力するコードを追加。
ソースタイプ、ユーザーID、リッチメニュー由来かどうかを出力。
```

### 指示3: 解析結果に英語を追加

```
functions/dify/handler.jsの128行目以降に、Difyの回答に英語が含まれているかチェックし、
含まれていない場合は簡易的な英語版を追加するコードを実装。
```

### 指示4: 会話の継続性を確保

```
functions/dify/chat.jsで、Firestoreから会話IDを取得し、Dify APIに渡す。
Dify APIから返された会話IDをFirestoreに保存する。
```

---

## 📋 ファイル構成

### 主要ファイル
- `functions/index.js` - LINE Webhookルーター（動画・テキストメッセージ処理）
- `functions/dify/handler.js` - 動画解析ジョブ処理（英語翻訳機能含む）
- `functions/dify/chat.js` - テキスト会話処理（会話の継続性管理）

### ドキュメント
- `VERIFICATION_REPORT.md` - 検証レポート
- `IMPLEMENTATION_FIXES.md` - 実装修正レポート
- `DEPLOYMENT_COMPLETE.md` - デプロイ完了レポート

---

**最終更新**: 2025-01-XX
**状態**: ✅ 実装完了、動作確認済み




