# 🔐 Make.comでサービスアカウントキー（JSON）を使った認証手順

## 📋 前提条件

- ✅ JSONファイル（サービスアカウントキー）をダウンロード済み
- ✅ Make.comにログインできる状態

---

## 🚀 手順（5分で完了）

### ステップ1: JSONファイルの内容をコピー

1. **ダウンロードしたJSONファイルをテキストエディタで開く**
   - Macの場合: テキストエディット、VSCode、メモ帳など
   - Windowsの場合: メモ帳、VSCodeなど

2. **JSONファイルの内容を確認**
   
   以下のような形式になっているはずです：
   ```json
   {
     "type": "service_account",
     "project_id": "aikaapp-584fa",
     "private_key_id": "xxxxx",
     "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
     "client_email": "make-com-firestore@aikaapp-584fa.iam.gserviceaccount.com",
     "client_id": "xxxxx",
     "auth_uri": "https://accounts.google.com/o/oauth2/auth",
     "token_uri": "https://oauth2.googleapis.com/token",
     "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
     "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/..."
   }
   ```

3. **JSONファイルの内容を全てコピー**
   - `Cmd + A` (Mac) または `Ctrl + A` (Windows) で全選択
   - `Cmd + C` (Mac) または `Ctrl + C` (Windows) でコピー
   - **重要**: 最初の `{` から最後の `}` まで、全てを含める

---

### ステップ2: Make.comで新しいシナリオを作成

1. **Make.comにログイン**
   ```
   https://www.make.com/
   ```

2. **「+ Create a new scenario」をクリック**
   - または、既存のシナリオを編集

3. **シナリオ名を設定（任意）**
   ```
   AIKA Firestore連携
   ```

---

### ステップ3: Cloud Firestoreモジュールを追加

1. **「+」ボタンをクリックしてモジュールを追加**

2. **「Apps」を検索**
   - 検索ボックスに「Firestore」または「Google Cloud Firestore」と入力

3. **「Google Cloud Firestore」を選択**

4. **モジュールタイプを選択**
   - **トリガー（監視）の場合**: 「Watch Documents」を選択
   - **データ取得の場合**: 「Get a Document」を選択
   - **データ更新の場合**: 「Update a Document」を選択

---

### ステップ4: サービスアカウントキーで接続を作成

1. **「Add a new connection」をクリック**

2. **接続タイプを選択**
   - **「Service Account Key」** を選択
   - ⚠️ **「Sign in with Google」（OAuth方式）は選択しない**

3. **「Service Account Key」フィールドに貼り付け**
   - ステップ1でコピーしたJSONファイルの内容を貼り付け
   - `Cmd + V` (Mac) または `Ctrl + V` (Windows)
   - **重要**: 改行やスペースを含めて、そのまま貼り付け

4. **「Save」をクリック**

5. **接続名を設定（任意）**
   ```
   AIKA Firestore
   ```

6. **「Save」をクリック**

---

### ステップ5: 接続の確認

接続が成功すると：
- ✅ 接続一覧に「Google Cloud Firestore」が表示される
- ✅ エラーメッセージが表示されない
- ✅ モジュールの設定画面が表示される

---

## 📊 Firestore監視（Watch Documents）の設定

### トリガー設定

1. **Collection Name（コレクション名）**
   ```
   video_jobs
   ```

2. **Clauses（条件）を追加**
   
   **フィールド1**:
   - **Field Path**: `status`
   - **Operator**: `Equal to`
   - **Value**: `completed`

3. **Limit（取得件数）**
   ```
   1
   ```

4. **「OK」をクリック**

---

## ⚠️ よくあるエラーと対処

### エラー1: "Invalid JSON format"

**原因**: JSONファイルの形式が正しくない

**対処**:
1. JSONファイルを再度開く
2. 最初の `{` から最後の `}` まで、全てを含める
3. 余分な改行やスペースがないか確認
4. 再度コピーして貼り付け

---

### エラー2: "Invalid service account key"

**原因**: サービスアカウントキーが無効、または権限が不足

**対処**:
1. Google Cloud Consoleでサービスアカウントを確認
   ```
   https://console.cloud.google.com/iam-admin/serviceaccounts?project=aikaapp-584fa
   ```
2. サービスアカウントに適切なロールが付与されているか確認
   - `Cloud Datastore User` ロールが必要
3. 新しいキーを生成してダウンロード
4. Make.comで接続を削除して再作成

---

### エラー3: "Permission denied"

**原因**: Firestoreへのアクセス権限が不足

**対処**:
1. Google Cloud Consoleでサービスアカウントのロールを確認
2. 以下のロールを付与：
   ```
   Cloud Datastore User
   ```
   または
   ```
   Firebase Admin SDK Administrator Service Agent
   ```
3. Make.comで接続を削除して再作成

---

### エラー4: "Collection not found"

**原因**: Firestoreにコレクションが存在しない

**対処**:
1. Firebase ConsoleでFirestoreを確認
   ```
   https://console.firebase.google.com/project/aikaapp-584fa/firestore
   ```
2. `video_jobs` コレクションが存在するか確認
3. 存在しない場合は、先にデータを作成するか、コレクション名を修正

---

## ✅ 動作確認

### テスト手順

1. **Firestoreでテストデータを作成**
   - Firebase Console → Firestore
   - コレクション: `video_jobs`
   - ドキュメントID: `test_123`
   - フィールド:
     ```
     status: "pending"
     userId: "test_user"
     ```

2. **ステータスを変更**
   ```
   status: "pending" → "completed"
   ```

3. **Make.comの実行履歴を確認**
   - Make.comのシナリオ画面で「Execution history」を開く
   - トリガーが発動したか確認

---

## 📝 JSONファイルの例（参考）

```json
{
  "type": "service_account",
  "project_id": "aikaapp-584fa",
  "private_key_id": "abc123def456...",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n",
  "client_email": "make-com-firestore@aikaapp-584fa.iam.gserviceaccount.com",
  "client_id": "123456789012345678901",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/make-com-firestore%40aikaapp-584fa.iam.gserviceaccount.com"
}
```

**⚠️ 重要**: 
- 実際のJSONファイルの内容をそのまま使用してください
- この例は参考用です

---

## 🔒 セキュリティ注意事項

1. **JSONファイルは機密情報です**
   - 公開しない
   - GitHubにコミットしない
   - 安全な場所に保管

2. **Make.comの接続設定は暗号化されています**
   - Make.comは接続情報を暗号化して保存
   - ただし、不要になった接続は削除することを推奨

3. **サービスアカウントキーを定期的にローテーション**
   - セキュリティのため、定期的に新しいキーを生成
   - 古いキーは無効化

---

## 📞 サポート

問題が解決しない場合：
1. Make.comの実行履歴でエラーメッセージを確認
2. Google Cloud Consoleでサービスアカウントの状態を確認
3. 上記のエラー対処方法を試す

---

**最終更新**: 2025-11-03

