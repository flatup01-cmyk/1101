# ⚡ Make.comクイックスタートガイド

## 🎯 5分でMake.comを設定する方法

このガイドは、社長向けのMake.comシナリオを現在の実装に合わせて修正したものです。

---

## ⚠️ 最初に確認すべきこと

### 現在の実装では:

- Firestoreの `status` は **`completed`** という値を使用
- スコアは **`analysis_result`** フィールドに保存
- ユーザーIDは **`userId`** フィールド

**→ Make.comのシナリオで、これらの値を正しく参照してください**

---

## 📋 修正されたMake.comシナリオ手順

### ステップ1: Firestoreトリガー

1. Make.comで「Cloud Firestore」モジュールを追加
2. **Watch Documents** を選択
3. Collection Name: **`video_jobs`**
4. Clauses:
   ```
   Field Path: status
   Operator: Equal to
   Value: completed  ← 重要: 'analysis_completed' ではなく 'completed'
   ```
5. Limit: **1**

---

### ステップ2: Dify API呼び出し

1. HTTPモジュールを追加
2. **Make a request** を選択
3. URL: あなたのDify APIエンドポイント
4. Method: **POST**
5. Headers:
   ```
   Authorization: Bearer YOUR_DIFY_API_KEY
   ```
6. Body (JSON):
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
   **重要**: `scores` → `analysis_result` に変更

7. **Parse response** をオンに

---

### ステップ3: LINE API送信

1. LINEモジュールを追加
2. **Send a Push Message** を選択
3. To: **`{{1.userId}}`**
4. Messages:
   ```
   Type: Text
   Text: {{2.data.answer}}  ← または {{2.answer}}（Difyのレスポンス構造に依存）
   ```

**注意**: 最初の実行で `{{2.data.answer}}` が動作しない場合は、Make.comの実行履歴を確認して、正しいフィールド名を使用してください。

---

### ステップ4: Firestore更新（オプション）

1. Cloud Firestoreモジュールを追加
2. **Update a Document** を選択
3. Document Path:
   ```
   Collection: video_jobs
   Document ID: {{1.__name__}}
   ```
4. Fields:
   ```
   Field Path: notification_sent
   Field Value: true
   ```

**注意**: Make.comシナリオでは `status: 'notification_sent'` に更新していますが、現在の実装では `notification_sent: true` というフラグを使用することを推奨します。

---

## 🔍 デバッグ方法

### 問題1: Make.comがトリガーされない

**確認事項**:
1. Firestoreの `video_jobs` コレクションで `status: 'completed'` のドキュメントが存在するか
2. Make.comのトリガー条件が正しいか
3. Make.comのスケジュールがONになっているか

---

### 問題2: Dify APIからエラーが返る

**確認事項**:
1. Make.comの実行履歴でHTTPモジュールの入力・出力を確認
2. `{{1.analysis_result.punch_speed}}` が正しく解決されているか
3. Dify APIのエンドポイントとAPIキーが正しいか

**解決策**:
- Firestoreドキュメントの実際の構造を確認
- Make.comのモジュール1（Firestore）の出力を確認して、正しいフィールド名を使用

---

### 問題3: LINEメッセージが送信されない

**確認事項**:
1. LINEモジュールの `To` フィールドに `{{1.userId}}` が正しく設定されているか
2. Dify APIのレスポンス構造を確認（`{{2.data.answer}}` vs `{{2.answer}}`）
3. LINEのチャネルアクセストークンが正しく設定されているか

**解決策**:
- Make.comの実行履歴でDify APIモジュール（モジュール2）の出力を確認
- 実際のレスポンス構造に合わせて `Text` フィールドを修正

---

## 📊 現在の実装との比較

| 項目 | 現在の実装（Cloud Functions） | Make.com導入後 |
|------|------------------------------|---------------|
| **解析** | Cloud Functions (MediaPipe) | Cloud Functions (MediaPipe) |
| **Dify API** | Cloud Functions内で呼び出し | Make.comで呼び出し |
| **LINE API** | Cloud Functions内で呼び出し | Make.comで呼び出し |
| **管理** | コードベース | 視覚的（Make.com UI） |
| **デバッグ** | ログ確認 | 実行履歴確認 |

---

## ✅ 動作確認チェックリスト

Make.com導入後、以下を確認してください：

- [ ] Firestoreに `status: 'completed'` のドキュメントを作成すると、Make.comがトリガーされる
- [ ] Dify APIが正しく呼び出される（実行履歴で確認）
- [ ] LINEメッセージがユーザーに届く
- [ ] Firestoreが `notification_sent: true` に更新される（オプション）
- [ ] エラー時にも適切に処理される

---

## 🎯 次のステップ

1. **Make.comでシナリオを作成**（上記の手順に従って）
2. **テスト実行**（Firestoreに手動でドキュメントを作成してテスト）
3. **本番運用**（Cloud FunctionsとMake.comが連携）

---

**最終更新**: 2025-01-XX  
**作成者**: AI Assistant (Auto)

