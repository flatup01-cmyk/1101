# ✅ MCP連携実装完了ガイド

## 🎉 実装完了！

提供いただいたDify API情報を使用して、MCP連携の実装を完了しました。

---

## 📋 実装内容

### 1. Dify API設定

以下のAPI情報をコードに組み込みました：

- **APIエンドポイント**: `https://api.dify.ai/v1/chat-messages`
- **APIキー**: `app-z5S8OBIYaET8dSCdN6G63yvF`

### 2. 実装した関数

#### ✅ `call_dify_via_mcp()` 関数
- MCPスタイルでDify APIを呼び出す
- 解析スコアをDifyに送信してAIKAのセリフを生成
- エラーハンドリング付き

#### ✅ `send_line_message_with_retry()` 関数
- LINE Messaging APIでメッセージを送信
- 指数関数的バックオフでリトライ処理（3回まで）
- 冪等性確保（重複送信防止）

### 3. `process_video()` 関数の修正

動画解析完了後に：
1. MCPスタイルでDify APIを呼び出し
2. AIKAのセリフを取得
3. LINE Messaging APIでユーザーに送信
4. Firestoreに結果を保存

---

## 🚀 次のステップ

### ステップ1: 環境変数を設定（オプション）

コードにはデフォルト値が設定されているため、**環境変数の設定は必須ではありません**。

ただし、本番環境では環境変数を使用することを推奨します：

1. **Firebase Consoleを開く**
   - https://console.firebase.google.com/project/aikaapp-584fa/functions

2. **環境変数を追加**（オプション）
   - `DIFY_API_ENDPOINT` = `https://api.dify.ai/v1/chat-messages`
   - `DIFY_API_KEY` = `app-z5S8OBIYaET8dSCdN6G63yvF`

### ステップ2: デプロイ

```bash
cd "/Users/jin/Library/CloudStorage/Dropbox/NEW WORLD/1101 new"
firebase deploy --only functions
```

**デプロイ時間**: 約5〜15分

### ステップ3: テスト実行

1. **LINEアプリでAIKAアプリを開く**
2. **動画をアップロード**（10秒以内、100MB以下）
3. **確認**:
   - ✅ 動画が解析される
   - ✅ Dify APIが呼び出される（ログで確認）
   - ✅ LINEでメッセージが届く

---

## 📊 システムフロー

```
【ユーザー】
    ↓ 動画アップロード
【LINE LIFFアプリ】
    ↓ Firebase Storage
【Cloud Functions】
    ├─ 動画解析（MediaPipe）
    └─ MCPスタイルでAPI呼び出し
        ↓
【Dify API】
    ├─ ワークフロー実行
    └─ AIKAメッセージ生成
        ↓
【Cloud Functions】
    └─ LINE Messaging API（リトライ付き）
        ↓
【ユーザー（LINE）】
    ✅ AIKAからのメッセージ到着
```

---

## 🔍 ログで確認できること

Firebase Console → Functions → ログ で以下を確認できます：

1. ✅ `📤 Dify MCP呼び出し: ...` - Dify APIへのリクエスト
2. ✅ `✅ Dify MCP成功: ...` - Dify APIからのレスポンス
3. ✅ `✅ LINEメッセージ送信成功: ...` - LINE送信成功
4. ⚠️ エラーが発生した場合は詳細なログが表示されます

---

## ✅ 完了チェックリスト

- [x] Dify API設定（コードに組み込み済み）
- [x] `call_dify_via_mcp()` 関数の実装
- [x] `send_line_message_with_retry()` 関数の実装
- [x] `process_video()` 関数の修正
- [ ] Cloud Functionsのデプロイ（次に実行）
- [ ] テスト実行（デプロイ後）

---

## 🎯 今すぐできること

1. **デプロイコマンドを実行**
   ```bash
   firebase deploy --only functions
   ```

2. **デプロイ完了後、テスト実行**
   - LINEアプリで動画をアップロード
   - ログで動作を確認

3. **完了！** 🎉

---

**最終更新**: 2025-01-XX  
**作成者**: AI Assistant (Auto)
















