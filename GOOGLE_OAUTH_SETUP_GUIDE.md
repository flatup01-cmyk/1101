# 🔐 Google OAuth同意画面設定ガイド（Make.com連携用）

## 📋 現在の画面での設定手順

### ステップ1: App Information（現在の画面）

#### 入力項目

**App name *（アプリ名）**
```
AIKA
```
※既に入力済みですが、確認してください。

**User support email *（ユーザーサポートメール）**
```
あなたのメールアドレスを入力
例: your-email@gmail.com
```
※Make.com連携で使用するGoogleアカウントのメールアドレスを入力

**App logo（オプション）**
- 任意: AIKA18号のロゴがあれば追加

**Next** をクリック

---

### ステップ2: Audience（対象ユーザー）

#### 選択肢

**🔹 Internal（内部）**
- ✅ **推奨**: 社内運用の場合
- Google Workspace組織内のみ使用可能
- 審査不要で即座に使用可能

**🔹 External（外部）**
- 一般ユーザー（顧客）に配布する場合
- 公開審査が必要
- より詳細な設定が必要

**選択**: 
```
Internal を選択（社内運用の場合）
または
External を選択（一般公開の場合）
```

**Next** をクリック

---

### ステップ3: Clients（OAuthクライアント）⚠️ 重要

#### クライアントの作成

1. **左メニューから「Clients」を選択**

2. **「+ CREATE CLIENT」をクリック**

3. **Application type（アプリケーションタイプ）**
   ```
   Web application
   ```

4. **Name（名前）**
   ```
   Make.com Integration
   ```

5. **Authorized redirect URIs（認可済みリダイレクトURI）** ⚠️ 完全一致で3つ追加
   ```
   https://www.make.com/oauth/cb
   https://us2.make.com/oauth/cb
   https://eu1.make.com/oauth/cb
   ```
   
   **⚠️ 重要（よくある間違い）**: 
   - ❌ `https://www.make.com/oauth/cb/` → 末尾スラッシュは**絶対に付けない**
   - ❌ `http://www.make.com/oauth/cb` → `http://` ではなく `https://` を使用
   - ❌ `https://make.com/oauth/cb` → `www.` が必要（メインリージョンの場合）
   - ❌ `https://www.make.com:443/oauth/cb` → ポート番号は不要
   - ✅ `https://www.make.com/oauth/cb` → 正しい形式
   - ✅ 完全一致で登録（大文字小文字も正確に）
   - ✅ エンコード不要（そのまま貼り付け）

6. **CREATE** をクリック

7. **生成された情報をコピー** ⚠️ この画面でしか見れないので必ず保存
   ```
   Client ID: xxxxxx.apps.googleusercontent.com
   Client Secret: GOCSPX-xxxxxx
   ```

**⚠️ 重要**: Client IDとClient Secretは後でMake.comの接続設定で使用します。安全な場所に保存してください。

---

### ステップ4: Data Access（データアクセス/スコープ）

#### スコープ設定

**必要なスコープ**:

1. **Firestore Read/Write**（デフォルトで含まれる）
   ```
   https://www.googleapis.com/auth/datastore
   ```

2. **追加が必要な場合**（Firestore監視には通常不要だが、念のため）
   ```
   https://www.googleapis.com/auth/cloud-platform.read-only
   ```

**設定方法**:
1. **左メニューから「Data Access」を選択**
2. **「ADD SCOPE」をクリック**
3. 必要なスコープを選択

**注意**: スコープは**最小限**にしてください。必要以上に権限を付与しない。

---

### ステップ5: Verification Center（外部公開の場合のみ）

**Internalを選択した場合**: このステップはスキップ可能

**Externalを選択した場合**: 以下を実施

1. **左メニューから「Verification Center」を選択**

2. **公開状態を確認**
   - **「Publish App」ボタンをクリック**（未公開の場合）

3. **必要な情報を入力**
   - **Privacy policy URL**（プライバシーポリシー）: 任意
   - **Terms of service URL**（利用規約）: 任意
   - **Authorized domains**（認可済みドメイン）: 
     ```
     make.com
     us2.make.com
     ```

4. **公開を実行**

**注意**: 公開審査には数日かかる場合があります。

---

## 🔗 Make.com側の接続設定

### ステップ1: Make.comでGoogle接続を作成

1. **Make.comにログイン**
2. **シナリオ編集画面を開く**
3. **Firestoreモジュールを追加**
4. **「Add a new connection」をクリック**

### ステップ2: OAuth認証

1. **「Sign in with Google」をクリック**
2. **Googleアカウントを選択**（OAuth設定に使用したアカウント）
3. **権限を許可**

### ステップ3: 接続確認

- ✅ 接続一覧に表示されれば成功
- ✅ エラーが消えれば正常

---

## 📊 Firestore監視設定（Make.com）

### トリガー設定

**Collection Name**:
```
video_jobs
```

**Clauses（条件）**:
```
Field Path: status
Operator: Equal to
Value: completed
```

**Limit**:
```
1
```

### ドキュメント構造の確認

実際のFirestoreドキュメント構造:

```json
{
  "userId": "Uxxxxxxx...",
  "originalFileName": "test.mp4",
  "status": "completed",
  "analysis_result": {
    "punch_speed": 85,
    "guard_stability": 72,
    "kick_height": 91,
    "core_rotation": 65
  },
  "aika_message": "...",
  "notification_sent": false,
  "createdAt": "...",
  "updatedAt": "..."
}
```

**Make.comでの参照**:
- ユーザーID: `{{1.userId}}`
- スコア: `{{1.analysis_result.punch_speed}}`
- ドキュメントID: `{{1.__name__}}`

---

## ⚠️ よくあるエラーと対処

### エラー1: リダイレクトURI不一致

**症状**: Make.comで「リダイレクトURI不一致」エラー

**原因**: 
- URIが完全一致していない
- 末尾に `/` がある
- サブドメインが間違っている

**対処**:
1. Google Cloud ConsoleのClients設定を確認
2. 以下を完全一致で追加（3つ全て）:
   ```
   https://www.make.com/oauth/cb
   https://us2.make.com/oauth/cb
   https://eu1.make.com/oauth/cb
   ```
3. **よくある間違いを確認**:
   - ❌ `https://www.make.com/oauth/cb/` (末尾スラッシュ)
   - ❌ `http://www.make.com/oauth/cb` (http)
   - ❌ `https://make.com/oauth/cb` (wwwなし)
   - ✅ `https://www.make.com/oauth/cb` (正しい)
4. Make.comの接続を削除して再作成
5. ブラウザキャッシュをクリアして再試行

---

### エラー2: 同意画面未公開

**症状**: Externalを選択したが、公開されていない

**対処**:
1. Verification Centerを開く
2. 「Publish App」をクリック
3. 必要情報を入力して公開

---

### エラー3: 権限不足

**症状**: Firestoreへのアクセスが拒否される

**対処**:
1. Cloud Consoleの「IAM & Admin」を開く
2. 使用するGoogleアカウントに以下のロールを付与:
   ```
   Datastore User
   ```
   または
   ```
   Cloud Datastore User
   ```

---

### エラー4: Firestoreクエリ不一致

**症状**: Make.comがトリガーされない

**確認事項**:
1. Firestoreで実際のドキュメント構造を確認
2. `status: "completed"` が書き込まれているか確認
3. フィールド名が正しいか確認（`analysis_result` vs `scores`）

**対処**:
- Make.comのClausesを実装に合わせて修正

---

### エラー5: APIエラーが続く

**症状**: 各種API呼び出しが失敗

**対処**:
1. Cloud Consoleの「Enabled APIs & services」を開く
2. 失敗しているAPIの詳細を確認:
   - **Cloud Firestore API**: 有効化されているか
   - **Google Cloud Resource Manager API**: 有効化されているか
3. 必要に応じて有効化

---

## 🧪 テストフロー

### 完全なテスト手順

1. **Google Cloud Console設定完了**
   - [x] App Information 完了
   - [x] Audience 選択完了
   - [x] Clients 作成完了（リダイレクトURI設定済み）
   - [x] Data Access スコープ設定完了
   - [x] Verification Center 公開完了（Externalの場合）

2. **Make.com接続完了**
   - [x] 「Sign in with Google」成功
   - [x] 接続一覧に表示
   - [x] エラーなし

3. **Firestoreテストデータ作成**
   ```
   Collection: video_jobs
   Document ID: test_123
   Fields:
     - userId: "test_user_123"
     - status: "pending"
   ```
   
4. **ステータス変更**
   ```
   status: "pending" → "completed"
   ```

5. **Make.comシナリオ実行確認**
   - [ ] Firestoreトリガーが発動
   - [ ] Dify API呼び出し成功
   - [ ] LINE API送信成功
   - [ ] Firestore更新（`notification_sent: true`）成功

6. **Difyレスポンス構造確認**
   - Make.comの実行履歴でHTTPモジュール（Dify API）の出力を確認
   - `{{2.data.answer}}` または `{{2.answer}}` のどちらが正しいか確認
   - LINEモジュールの `Text` フィールドを修正

---

## 📝 入力内容まとめ（コピペ用）

### App Information
- **App name**: `AIKA`
- **User support email**: `your-email@gmail.com` ← あなたのメールアドレス

### Clients（リダイレクトURI）
```
https://www.make.com/oauth/cb
https://us2.make.com/oauth/cb
```

### Data Access（スコープ）
```
https://www.googleapis.com/auth/datastore
```

### Firestore監視（Make.com）
- **Collection**: `video_jobs`
- **Clause**: `status = "completed"`
- **Limit**: `1`

---

**最終更新**: 2025-01-XX  
**作成者**: AI Assistant (Auto)

