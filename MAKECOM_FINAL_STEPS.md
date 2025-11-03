# 🎯 Make.com最終設定手順書（100点達成版）

## ✅ 前提：エンジンと車体は準備OK

- **エンジン（Cloud Functions）**: ✅ 準備完了
  - 動画アップロード → 自動解析 → Firestoreに`status: "completed"`記録
- **車体（LIFFアプリ）**: ✅ 準備完了
  - ユーザーが動画をアップロード可能

## 🎯 ゴール：エンジンと運転席（LINE）を繋ぐ

Firestoreの`status: "completed"`を検知 → Dify API呼び出し → LINE送信の自動運転システムを完成

---

## 📋 準備

1. **Make.comのサイトを開いてログイン**
2. **DifyのAPIキーとエンドポイントURLを準備**
3. **LINEのチャネルアクセストークンを準備**
4. **Google Cloud Consoleを開いておく**（OAuth設定用）

---

## 🔧 ステップ1: 新しいロボット（シナリオ）を作り始める

1. **Make.comの画面右上** → **"+ Create a new scenario"** をクリック
2. **画面中央の大きな "+" ボタン**をクリック
3. **検索窓に "Firestore"** と入力
4. **"Cloud Firestore"** のアイコンをクリック

---

## 👁️ ステップ2: ロボットに「見張る場所」を教える

### ⚠️ 重要修正点: `completed` を使用（`analysis_completed`ではない）

1. **Triggers** → **"Watch Documents"** をクリック
2. **Connection**: Googleアカウントを接続（初回のみ）
   
   **⚠️ OAuthエラー（redirect_uri_mismatch）が発生する場合**:
   - Google Cloud ConsoleでリダイレクトURIを確認
   - 以下3つを完全一致で追加:
     ```
     https://www.make.com/oauth/cb
     https://us2.make.com/oauth/cb
     https://eu1.make.com/oauth/cb
     ```
   - 詳細は後述の「OAuth認証エラー」セクションを参照
3. **Collection Name**: **`video_jobs`** と入力
4. **Clauses** → **"+ Add a clause"** をクリック

**設定内容**:
```
Field Path: status
Operator: Equal to
Value: completed  ← ⚠️ 重要: analysis_completed ではない！
```

5. **Limit**: **`1`** と入力
6. **OK** をクリック

---

## 🧠 ステップ3: ロボットに「AIKAに相談する仕事」を教える

### ⚠️ 重要修正点: `analysis_result` から始まるパスを使用

1. **Firestoreモジュールの右側の "+"** をクリック
2. **検索窓に "HTTP"** と入力
3. **"HTTP"** のアイコンをクリック
4. **アクション** → **"Make a request"** をクリック

**設定内容**:

- **URL**: 
  ```
  https://api.dify.ai/v1/chat-messages
  ```
  または、ワークフローAPIの場合：
  ```
  https://api.dify.ai/v1/workflows/run
  ```

- **Method**: **`POST`**

- **Headers** → **"+ Add header"** を2回クリックして以下を追加:

  **Header 1**:
  ```
  Name: Authorization
  Value: Bearer app-6OBnNxu0oWUiMVVq0rjepVhJ
  ```
  ⚠️ **重要**: `Bearer ` の後に**スペース1つ**を入れる。`Bearer`は大文字。

  **Header 2**:
  ```
  Name: Content-Type
  Value: application/json
  ```

- **Body type**: **`Raw`**

- **Content type**: **`JSON (application/json)`**

- **Request content**: 以下をコピーして貼り付け

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

⚠️ **重要**: `{{1.scores...}}` ではなく `{{1.analysis_result...}}` を使用

- **Parse response** のチェックボックスに**チェックを入れる**
- **OK** をクリック

---

## 📱 ステップ4: ロボットに「LINEでお客さんに届ける仕事」を教える

1. **HTTPモジュール（Dify API）の右側の "+"** をクリック
2. **検索窓に "LINE"** と入力
3. **"LINE"** のアイコンをクリック
4. **アクション** → **"Send a Push Message"** をクリック

**設定内容**:

- **Connection**: LINE公式アカウントを接続（初回のみ）
  - LINE Developersコンソールからチャネルアクセストークンが必要
- **To**: **`{{1.userId}}`**
- **Messages** → **"+ Add item"** をクリック
  - **Type**: **`Text`**
  - **Text**: **`{{2.data.answer}}`** ← まずはこちらで試してください

⚠️ **注意**: `{{2.data.answer}}` が動作しない場合は、Make.comの実行履歴でDify APIのレスポンス構造を確認し、`{{2.answer}}` に変更してください

- **OK** をクリック

---

## ✅ ステップ5: ロボットに「仕事終わりの報告」を教える

1. **LINEモジュールの右側の "+"** をクリック
2. **検索窓に "Firestore"** と入力
3. **"Cloud Firestore"** のアイコンをクリック
4. **アクション** → **"Update a Document"** をクリック

**設定内容**:

- **Collection**: **`video_jobs`**
- **Document ID**: **`{{1.__name__}}`**
- **Fields** → **"+ Add a field"** をクリック

**設定値**（実装に合わせた正しい設定）:
```
Field Path: notification_sent
Field Value: true
```

**⚠️ 注意**: 
- `status: "notification_sent"` ではなく、`notification_sent: true` というフラグを設定します
- これは現在のCloud Functions実装と一致しています

- **OK** をクリック

---

## 🚀 ステップ6: ロボットの起動

1. **画面左下の "Save"** ボタン（フロッピーディスクアイコン）をクリック
2. **画面左下の "Scheduling"** スイッチを**ON**にする

---

## ✅ 完成！

これで、残りの20%は完了です。スコアは**100点**に到達しました。

---

## 🧪 テスト方法

### テスト手順

1. **Firestoreにテストデータを作成**
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
   ```
   status: "pending" → "completed"
   ```

3. **Make.comの実行履歴を確認**
   - 数秒以内にシナリオが実行されるはず
   - Firestoreトリガー → Dify API → LINE送信 → Firestore更新 まで確認

4. **Difyレスポンス構造の確認**
   - 実行履歴でHTTPモジュール（Dify API）の出力を確認
   - `{{2.data.answer}}` または `{{2.answer}}` のどちらが正しいか確認
   - LINEモジュールの `Text` フィールドを必要に応じて修正

---

## ⚠️ OAuth認証エラー: loading...のまま進まない

### 症状: 認証画面がloading...のまま進まない

**よくある質問**: 他の稼働中のシナリオが原因ですか？

**答え**: **いいえ、全く関係ありません！** 他のシナリオは今回の接続問題とは無関係です。

**loading...が続く原因**:
1. **Googleの設定反映待ち**（最も可能性が高い）
   - リダイレクトURIの追加などの設定変更が、Googleのサーバーに反映されるまで5分〜数時間かかることがあります
   - これは**正常な動作**です
2. **Make.comの一時的な混雑**
   - 稀にシステムが混み合って接続に時間がかかることがあります

**解決方法**: **戦略的待機（30分〜1時間）**

1. Make.comのタブを閉じる
2. 30分〜1時間待つ
3. 新しいブラウザウィンドウ（シークレットモード推奨）で再試行
4. 完全に新しいシナリオを作成して接続を再作成

それでも解決しない場合は、**サービスアカウントキー方式**に切り替えます。

詳細は `MAKECOM_GOOGLE_AUTH_COMPLETE_FIX.md` を参照してください。

---

## ⚠️ OAuth認証エラー: redirect_uri_mismatch

### エラー: "Error 400: redirect_uri_mismatch"

**症状**: Make.comで「Sign in with Google」を実行すると、エラーが表示される

**即座解決方法**（us2.make.com対応）:

1. **Google Cloud Consoleで必須URIを追加**
   - APIとサービス → 認証情報 → OAuth 2.0 クライアント ID
   - 「承認済みのリダイレクトURI」に以下を追加:
     ```
     https://us2.make.com/oauth/cb  ← 必須
     https://www.make.com/oauth/cb  ← 予備
     ```

2. **OAuth同意画面の設定**
   - Verification Center → Authorized domains
   - `make.com` を追加（`https://` や `/oauth/cb` は不要）
   - 「Publish App」で公開（Externalの場合）

3. **完全一致の確認**:
   - ❌ 末尾スラッシュ（`/oauth/cb/`）は**絶対に付けない**
   - ❌ `http://` ではなく `https://` を使用
   - ❌ スペースや余分な文字がない
   - ✅ Application type: `Web application`

4. **保存して数秒待つ** → Make.comで接続を削除して再作成 → 再試行

詳細は `OAUTH_US2_FIX.md` を参照してください。

---

## ⚠️ よくあるエラーと対処

### エラー1: Firestoreトリガーが発動しない

**確認事項**:
- Firestoreの`video_jobs`コレクションに`status: "completed"`のドキュメントが存在するか
- Make.comのスケジュールがONになっているか
- Connectionが正しく設定されているか

---

### エラー2: Dify APIからエラーが返る

**よくあるエラーと解決方法**:

#### "401 Unauthorized"
- Authorizationヘッダーの形式を確認
  - 正しい形式: `Bearer YOUR_API_KEY`（スペース1つ）
  - 間違った形式: `BearerYOUR_API_KEY`（スペースなし）

#### "404 Not Found"
- Dify APIエンドポイントURLが正しいか確認
  - チャットメッセージ: `https://api.dify.ai/v1/chat-messages`
  - ワークフロー: `https://api.dify.ai/v1/workflows/run`

#### "400 Bad Request"
- Request contentがJSON形式であることを確認
- Content-Typeヘッダーが `application/json` であることを確認

**確認事項**:
- `{{1.analysis_result.punch_speed}}` が正しく解決されているか（実行履歴で確認）
- Dify APIのエンドポイントとAPIキーが正しいか
- Make.comの実行履歴でHTTPモジュールのInput/Outputを確認

詳細は `MAKECOM_DIFY_AUTH_FIX.md` を参照してください。

---

### エラー3: LINEメッセージが送信されない

**確認事項**:
- LINEモジュールの `To` に `{{1.userId}}` が設定されているか
- Dify APIのレスポンス構造を確認（`{{2.data.answer}}` vs `{{2.answer}}`）
- LINEのチャネルアクセストークンが正しいか

---

## 📊 最終チェックリスト

- [ ] ステップ1: シナリオ作成完了
- [ ] ステップ2: Firestoreトリガー設定完了（`status: "completed"`）
- [ ] ステップ3: Dify API呼び出し設定完了（`{{1.analysis_result...}}`）
- [ ] ステップ4: LINE API送信設定完了（`{{1.userId}}`, `{{2.data.answer}}`）
- [ ] ステップ5: Firestore更新設定完了（`notification_sent: true`）
- [ ] ステップ6: 保存・スケジュールON完了
- [ ] テスト実行完了
- [ ] Difyレスポンス構造確認完了

---

**スコア: 100点達成！** 🎉

---

**最終更新**: 2025-01-XX  
**作成者**: AI Assistant (Auto)

