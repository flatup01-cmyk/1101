# 🎯 Make.com最終設定手順書（社長専用）

## ✅ 最終チェック済み - あなたの手で完成させてください

この手順書は、現在の実装コードと完全に一致するように作成されています。

---

## 🔧 必須修正3点（チェックリスト）

Make.comシナリオを作成する際、以下3点を必ず修正してください：

- [ ] **修正1**: Firestoreトリガーの値: `analysis_completed` → `completed`
- [ ] **修正2**: Dify API Body: `{{1.scores...}}` → `{{1.analysis_result...}}`
- [ ] **修正3**: LINEメッセージ: Difyのレスポンス構造を確認して設定

---

## 📋 ステップバイステップ手順（完全版）

### ステップ1: Make.comで新しいシナリオを作成

1. Make.comにログイン
2. 右上の **"+ Create a new scenario"** をクリック
3. 画面中央の大きな **"+"** ボタンをクリック

---

### ステップ2: Firestoreトリガーを設定（⚠️ 修正1）

1. 検索窓に **"Firestore"** と入力
2. **"Cloud Firestore"** を選択

**設定内容**:
- トリガー: **"Watch Documents"** を選択
- Connection: Googleアカウントを接続（初回のみ）
- **Enter a Collection**: **"Listen for documents in a collection at a query"** を選択
- **Collection Name**: **`video_jobs`** を入力

**Clauses（重要）**:
- **"+ Add a clause"** をクリック
- **Field Path**: `status`
- **Operator**: `Equal to`
- **Value**: **`completed`** ← ⚠️ `analysis_completed` ではなく `completed`

- **Limit**: `1`

**OK** をクリック

---

### ステップ3: Dify API呼び出しを設定（⚠️ 修正2）

1. Firestoreモジュールの右側に現れる **"+"** ボタンをクリック
2. 検索窓に **"HTTP"** と入力
3. **"HTTP"** を選択
4. アクション: **"Make a request"** を選択

**設定内容**:
- **URL**: あなたのDify APIエンドポイントURL（例: `https://api.dify.ai/v1/workflows/run`）
- **Method**: `POST`

**Headers**:
- **"+ Add header"** をクリック
- **Name**: `Authorization`
- **Value**: `Bearer YOUR_DIFY_API_KEY` ← あなたのDify APIキーに置き換え

**Body**:
- **Body type**: `Raw`
- **Content type**: `JSON (application/json)`
- **Request content**: 以下を貼り付け（⚠️ `analysis_result` を使用）

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

**重要**: `{{1.scores...}}` ではなく `{{1.analysis_result...}}` を使用してください。

- **Parse response** のチェックボックスを **オン** にする

**OK** をクリック

---

### ステップ4: LINE API送信を設定（⚠️ 修正3）

1. HTTPモジュール（Dify API）の右側の **"+"** ボタンをクリック
2. 検索窓に **"LINE"** と入力
3. **"LINE"** を選択
4. アクション: **"Send a Push Message"** を選択

**設定内容**:
- **Connection**: LINE公式アカウントを接続（初回のみ）
  - LINE Developersコンソールからチャネルアクセストークンが必要です

**送信先**:
- **To**: `Map` を選択し、入力欄に **`{{1.userId}}`** を入力

**メッセージ**:
- **Messages** の **"+ Add item"** をクリック
- **Type**: `Text`
- **Text**: **`{{2.data.answer}}`** を入力 ← ⚠️ まずはこちらで試してください

**OK** をクリック

---

### ステップ5: Firestore更新（オプション・推奨）

1. LINEモジュールの右側の **"+"** ボタンをクリック
2. **"Cloud Firestore"** を選択
3. アクション: **"Update a Document"** を選択

**設定内容**:
- **Document Path**:
  - **Collection**: `video_jobs`
  - **Document ID**: **`{{1.__name__}}`** を入力

**Fields**:
- **"+ Add a field"** をクリック
- **Field Path**: `notification_sent`
- **Field Value**: `true`

**OK** をクリック

---

## 🧪 テスト実行方法

### テスト手順

1. **Make.comシナリオを保存**（左下の **"Save"** ボタン）
2. **スケジュールをON**に（左下の **"Schedule"** スイッチ）
3. **Firebaseコンソール**で手動テスト：
   - Firestoreの `video_jobs` コレクションにドキュメントを作成
   - 以下のフィールドを設定：
     ```json
     {
       "userId": "test_user_123",
       "status": "completed",
       "analysis_result": {
         "punch_speed": 85,
         "guard_stability": 72,
         "kick_height": 91,
         "core_rotation": 65
       }
     }
     ```
4. **Make.comの実行履歴を確認**（数秒以内に実行されるはず）

---

## 🔍 デバッグ方法（Difyレスポンス構造の確認）

### 問題: `{{2.data.answer}}` が動作しない場合

**解決手順**:

1. **Make.comの実行履歴を開く**
   - シナリオページの **"Execution history"** をクリック
   - 最新の実行を選択

2. **HTTPモジュール（Dify API）をクリック**
   - **"Output"** タブを確認
   - Dify APIが返したデータの構造を確認

3. **正しいフィールド名を確認**
   - レスポンスが以下のような構造の場合：
     ```json
     {
       "answer": "ツンデレメッセージ..."
     }
     ```
     → `{{2.answer}}` を使用

   - レスポンスが以下のような構造の場合：
     ```json
     {
       "data": {
         "answer": "ツンデレメッセージ..."
       }
     }
     ```
     → `{{2.data.answer}}` を使用

4. **LINEモジュールを修正**
   - LINEモジュールの **"Text"** フィールドを修正
   - 正しいフィールド名（`{{2.answer}}` または `{{2.data.answer}}`）に変更

5. **再度テスト実行**

---

## ✅ 最終確認チェックリスト

シナリオを完成させる前に、以下を確認してください：

- [ ] Firestoreトリガーの値が `completed` になっている
- [ ] Dify API Bodyの `{{1.analysis_result...}}` が正しく設定されている
- [ ] LINEモジュールの `To` に `{{1.userId}}` が設定されている
- [ ] LINEモジュールの `Text` に `{{2.data.answer}}` または `{{2.answer}}` が設定されている
- [ ] Make.comのスケジュールがONになっている
- [ ] シナリオが保存されている

---

## 🎉 完了

これで、Make.comシナリオの設定は完了です。

**Cloud Functionsが `status: 'completed'` に更新した瞬間、Make.comが自動的に：**
1. Dify APIを呼び出してAIKAのセリフを生成
2. LINE APIでユーザーにメッセージを送信
3. Firestoreを `notification_sent: true` に更新

**完全自動化システムの完成です！**

---

## 🆘 トラブルシューティング

### 問題1: Make.comがトリガーされない

**確認事項**:
- Firestoreのドキュメントで `status: 'completed'` が設定されているか
- Make.comのスケジュールがONになっているか
- Make.comの接続（Connection）が正しく設定されているか

### 問題2: Dify APIがエラーを返す

**確認事項**:
- Dify APIのエンドポイントURLが正しいか
- APIキーが正しく設定されているか
- `{{1.analysis_result...}}` が正しく解決されているか（実行履歴で確認）

### 問題3: LINEメッセージが届かない

**確認事項**:
- LINEモジュールの `To` に `{{1.userId}}` が設定されているか
- Dify APIのレスポンス構造が正しいか（実行履歴で確認）
- LINEのチャネルアクセストークンが正しく設定されているか

---

**最終更新**: 2025-01-XX  
**作成者**: AI Assistant (Auto)  
**承認**: 社長（あなた）

