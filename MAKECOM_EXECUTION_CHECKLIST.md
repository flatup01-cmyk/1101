# ✅ Make.com設定 実行チェックリスト

## 🎯 最終確認ポイント

手順書 `MAKECOM_FINAL_STEPS.md` に従って設定する際、以下を必ず確認してください。

---

## ⚠️ 最重要：3つの修正点

### 修正点1: ステップ2（Firestoreトリガー）

**確認**: ClausesのValueが `completed` になっているか

```
✅ 正しい: Value = "completed"
❌ 間違い: Value = "analysis_completed"
```

---

### 修正点2: ステップ3（Dify API呼び出し）

**確認**: Request contentのパスが `{{1.analysis_result...}}` になっているか

```json
✅ 正しい:
"punch_speed_score": "{{1.analysis_result.punch_speed}}"

❌ 間違い:
"punch_speed_score": "{{1.scores.punch_speed}}"
```

---

### 修正点3: ステップ5（Firestore更新）

**確認**: Field Valueが `true` になっているか

```
✅ 正しい:
Field Path: notification_sent
Field Value: true

❌ 間違い:
Field Path: status
Field Value: notification_sent
```

---

## 📋 設定完了チェックリスト

各ステップで以下を確認：

- [ ] **ステップ1**: シナリオ作成完了
- [ ] **ステップ2**: 
  - [ ] Firestoreトリガー設定完了
  - [ ] Collection Name: `video_jobs`
  - [ ] Value: `completed` ← 重要
  - [ ] Connection: Googleアカウント接続済み
  - [ ] OAuthエラーがない（あれば `OAUTH_ERROR_FIX_NOW.md` を参照）
- [ ] **ステップ3**:
  - [ ] HTTPモジュール追加完了
  - [ ] Dify APIエンドポイントURL設定
  - [ ] Authorization Header設定（Bearer YOUR_API_KEY）
  - [ ] Body: `{{1.analysis_result...}}` ← 重要
  - [ ] Parse response: チェック済み
- [ ] **ステップ4**:
  - [ ] LINEモジュール追加完了
  - [ ] Connection: LINE接続済み
  - [ ] To: `{{1.userId}}`
  - [ ] Text: `{{2.data.answer}}` または `{{2.answer}}`
- [ ] **ステップ5**:
  - [ ] Firestore更新モジュール追加完了
  - [ ] Collection: `video_jobs`
  - [ ] Document ID: `{{1.__name__}}`
  - [ ] Field Path: `notification_sent`
  - [ ] Field Value: `true` ← 重要
- [ ] **ステップ6**:
  - [ ] Save完了
  - [ ] Scheduling: ON

---

## 🧪 設定後のテスト

### テスト手順

1. **Firestoreにテストデータを作成**
   - Firebase Console → Firestore Database
   - Collection: `video_jobs`
   - Document ID: `test_123`（任意）
   - Fields:
     ```json
     {
       "userId": "test_user_123",
       "status": "pending",
       "analysis_result": {
         "punch_speed": 85,
         "guard_stability": 72,
         "kick_height": 91,
         "core_rotation": 65
       }
     }
     ```

2. **statusを変更**
   - `status: "pending"` → `status: "completed"`

3. **Make.comの実行履歴を確認**
   - シナリオページ → "Execution history"
   - 数秒以内に実行されるはず

4. **各モジュールの成功/失敗を確認**
   - Firestoreトリガー: ✅ 成功
   - HTTP (Dify API): ✅ 成功
   - LINE送信: ✅ 成功
   - Firestore更新: ✅ 成功

---

## 🆘 エラーが発生した場合

### エラーの確認方法

1. **Make.comの実行履歴を開く**
   - シナリオページ → "Execution history"
   - 失敗した実行を選択

2. **各モジュールをクリックして確認**
   - **Input**: 入力データを確認
   - **Output**: 出力データを確認（エラーがある場合）
   - **Error**: エラーメッセージを確認

3. **エラーメッセージをコピー**
   - エラーメッセージの全文をコピー
   - どのモジュールでエラーが発生したかメモ

### よくあるエラーと対処

**エラー1: Firestoreトリガーが発動しない**
- 確認: `status: "completed"` のドキュメントが存在するか
- 確認: スケジュールがONになっているか

**エラー2: `{{1.analysis_result.punch_speed}}` が解決されない**
- 確認: Firestoreドキュメントに `analysis_result` フィールドがあるか
- 確認: 実行履歴でFirestoreモジュールの出力を確認

**エラー3: Dify APIからエラーが返る**
- 確認: APIエンドポイントURLが正しいか
- 確認: APIキーが正しいか
- 確認: リクエストBodyが正しいか

**エラー4: LINEメッセージが送信されない**
- 確認: `{{1.userId}}` が正しく解決されているか
- 確認: `{{2.data.answer}}` または `{{2.answer}}` が正しいか（実行履歴でDify APIの出力を確認）
- 確認: LINEのチャネルアクセストークンが正しいか

---

## 💡 設定のコツ

1. **1つずつ設定**
   - 1つのモジュールを設定したら、すぐに「OK」をクリック
   - 次のモジュールに進む

2. **各モジュールを確認**
   - 設定画面を閉じる前に、入力内容を再確認

3. **実行履歴を活用**
   - テスト実行後、各モジュールの入出力を確認
   - データの流れを可視化して理解

---

## 🎉 完成の確認

全ての設定が完了し、テストが成功したら：

✅ **スコア: 100点達成！**

AIKAバトルスカウターの完全自動応答システムが完成しました。

---

**最終更新**: 2025-01-XX  
**作成者**: AI Assistant (Auto)





