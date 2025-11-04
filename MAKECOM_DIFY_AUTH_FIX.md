# 🔐 Make.com Dify API認証エラー解決ガイド

## ❌ 問題：Dify APIへの認証が取れない

Make.comのHTTPモジュールでDify APIを呼び出す際に認証エラーが発生します。

---

## ✅ ステップ1: Dify API情報を確認

### 必要な情報を準備

1. **Dify APIエンドポイントURL**
   ```
   https://api.dify.ai/v1/chat-messages
   ```
   または、ワークフローAPIの場合：
   ```
   https://api.dify.ai/v1/workflows/run
   ```

2. **Dify APIキー**
   - Dify Studio → 設定 → API Keys
   - または、既存のAPIキー: `app-6OBnNxu0oWUiMVVq0rjepVhJ`

---

## ✅ ステップ2: Make.comでHTTPモジュールを正しく設定

### 1. HTTPモジュールを追加

1. **Make.comシナリオ編集画面で**
2. **Firestoreモジュールの右側の "+"** をクリック
3. **検索窓に "HTTP"** と入力
4. **"HTTP"** のアイコンをクリック
5. **アクション** → **"Make a request"** を選択

### 2. 基本設定

**URL**: 
```
https://api.dify.ai/v1/chat-messages
```
または、ワークフローAPIの場合：
```
https://api.dify.ai/v1/workflows/run
```

**Method**: 
```
POST
```

### 3. ⚠️ 重要：Authorizationヘッダーの設定

**Headers**セクションで以下を設定：

**Name**: 
```
Authorization
```

**Value**: 
```
Bearer app-6OBnNxu0oWUiMVVq0rjepVhJ
```

⚠️ **重要ポイント**:
- **`Bearer `** の後に**スペース1つ**を入れる
- **`Bearer`** は大文字で始める
- APIキーの前に**スペースが必須**

**正しい形式**:
```
Bearer YOUR_API_KEY
```

**間違った形式**:
```
BearerYOUR_API_KEY  ← スペースがない
bearer YOUR_API_KEY  ← 小文字（動作しない場合あり）
Bearer  YOUR_API_KEY  ← スペースが2つ
YOUR_API_KEY  ← Bearerがない
```

### 4. Content-Typeヘッダーの設定

**Name**: 
```
Content-Type
```

**Value**: 
```
application/json
```

### 5. Body設定

**Body type**: 
```
Raw
```

**Content type**: 
```
JSON (application/json)
```

**Request content**: 
```json
{
  "inputs": {
    "punch_speed_score": "{{1.analysis_result.punch_speed}}",
    "guard_stability_score": "{{1.analysis_result.guard_stability}}",
    "kick_height_score": "{{1.analysis_result.kick_height}}",
    "core_rotation_score": "{{1.analysis_result.core_rotation}}"
  },
  "response_mode": "blocking",
  "user": "{{1.userId}}"
}
```

### 6. Parse responseを有効化

✅ **Parse response** のチェックボックスに**チェックを入れる**

これにより、レスポンスがJSON形式でパースされ、次のモジュールで `{{2.data.answer}}` のように参照できます。

---

## 🔍 ステップ3: よくあるエラーと解決方法

### エラー1: "401 Unauthorized"

**原因**: Authorizationヘッダーの形式が間違っている

**解決方法**:
1. Authorizationヘッダーの値を確認
   - `Bearer YOUR_API_KEY` の形式であること
   - スペースが1つであること
   - APIキーが正しいこと

2. Make.comで接続を再確認
   - HTTPモジュール → Headers → Authorization を確認

---

### エラー2: "404 Not Found"

**原因**: APIエンドポイントURLが間違っている

**解決方法**:
1. Dify Studioで正しいエンドポイントを確認
   - Dify Studio → 設定 → API
   - エンドポイントURLを確認

2. エンドポイントURLのパスを確認
   - チャットメッセージ: `https://api.dify.ai/v1/chat-messages`
   - ワークフロー: `https://api.dify.ai/v1/workflows/run`

---

### エラー3: "400 Bad Request"

**原因**: リクエストボディの形式が間違っている

**解決方法**:
1. Request contentがJSON形式であることを確認
2. Content-Typeヘッダーが `application/json` であることを確認
3. JSONの構文エラーがないか確認

---

### エラー4: "Connection failed" または "Network error"

**原因**: ネットワーク接続の問題、またはAPIキーの権限不足

**解決方法**:
1. Dify StudioでAPIキーの権限を確認
   - APIキーが有効であること
   - 適切な権限（読み書き）があること

2. インターネット接続を確認
3. Make.comのサービスステータスを確認

---

## 🧪 ステップ4: テスト実行

### テスト手順

1. **Make.comでシナリオを保存**
   - 画面左下の "Save" ボタンをクリック

2. **手動でテスト実行**
   - シナリオ画面で "Run once" をクリック
   - または、実際にFirestoreで `status: "completed"` に変更

3. **実行履歴を確認**
   - 実行履歴でHTTPモジュール（Dify API）をクリック
   - **Input** タブ: 送信されたリクエストを確認
     - URL
     - Headers（Authorizationヘッダーが正しく設定されているか）
     - Body
   - **Output** タブ: レスポンスを確認
     - Status Code: `200` であれば成功
     - Body: Difyからのレスポンス

---

## 📊 ステップ5: レスポンス構造の確認

### 成功時のレスポンス例

```json
{
  "event": "message",
  "task_id": "abc123",
  "id": "msg-xyz",
  "message_id": "msg-xyz",
  "answer": "…別に、アンタの動画を解析してやってもいいけど？",
  "created_at": 1234567890,
  "conversation_id": "conv-abc"
}
```

または：

```json
{
  "data": {
    "answer": "…別に、アンタの動画を解析してやってもいいけど？",
    "message_id": "msg-xyz"
  }
}
```

### Make.comでの参照方法

**パターン1**: `answer` がトップレベルにある場合
```
{{2.answer}}
```

**パターン2**: `data.answer` にある場合
```
{{2.data.answer}}
```

**確認方法**:
1. Make.comの実行履歴でHTTPモジュールの出力を確認
2. 実際のレスポンス構造に合わせてLINEモジュールの `Text` フィールドを設定

---

## ✅ 設定完了チェックリスト

- [ ] Dify APIエンドポイントURLが正しく設定されている
- [ ] Authorizationヘッダーが `Bearer YOUR_API_KEY` の形式である（スペース1つ）
- [ ] Content-Typeヘッダーが `application/json` である
- [ ] Request contentがJSON形式で正しく設定されている
- [ ] Parse responseが有効になっている
- [ ] テスト実行でStatus Codeが200である
- [ ] レスポンス構造を確認し、LINEモジュールで正しいフィールドを参照している

---

## 🆘 それでも解決しない場合

### デバッグ手順

1. **Make.comの実行履歴を確認**
   - HTTPモジュールの **Input** タブで送信されたリクエストを確認
   - **Output** タブで受け取ったレスポンスを確認

2. **Dify StudioでAPIキーを再確認**
   - 新しいAPIキーを生成してみる
   - APIキーの権限を確認

3. **Make.comのサポートに問い合わせ**
   - 実行履歴のスクリーンショットを添付
   - エラーメッセージを添付

---

## 💡 追加のヒント

### DifyワークフローAPIを使用する場合

ワークフローAPIを使用する場合は、エンドポイントURLとリクエストボディが異なります：

**エンドポイントURL**:
```
https://api.dify.ai/v1/workflows/run
```

**リクエストボディ**:
```json
{
  "inputs": {
    "punch_speed_score": "{{1.analysis_result.punch_speed}}",
    "guard_stability_score": "{{1.analysis_result.guard_stability}}",
    "kick_height_score": "{{1.analysis_result.kick_height}}",
    "core_rotation_score": "{{1.analysis_result.core_rotation}}"
  },
  "response_mode": "blocking",
  "user": "{{1.userId}}"
}
```

Authorizationヘッダーの設定方法は同じです。

---

**最終更新**: 2025-01-XX  
**作成者**: AI Assistant (Auto)




