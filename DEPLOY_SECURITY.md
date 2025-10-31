# 🔒 セキュリティ対策のデプロイ手順

## ✅ 実装済みのセキュリティ対策

1. ✅ レートリミット機能（`functions/rate_limiter.py`）
2. ✅ Firebase Storageセキュリティルール（`storage.rules`）
3. ✅ APIキー保護（サーバーサイドのみ）
4. ✅ ファイルサイズ・形式制限

---

## 📋 デプロイ手順

### ステップ1: Firebase Storageルールをデプロイ

```bash
cd "/Users/jin/Library/CloudStorage/Dropbox/NEW WORLD/1101 new"
firebase deploy --only storage
```

**確認:**
- Firebase Console → Storage → ルール
- `storage.rules`の内容が反映されているか確認

---

### ステップ2: Cloud Functionsをデプロイ（レートリミット機能含む）

```bash
firebase deploy --only functions
```

**新しい依存関係:**
- `google-cloud-firestore==2.18.0` が追加されました

**確認:**
- Firebase Console → Functions → ログ
- デプロイ成功を確認

---

### ステップ3: Firestoreコレクションの作成確認

レートリミット機能が動作すると、自動で以下が作成されます：

- **コレクション:** `rate_limits`
- **ドキュメントID:** `{userId}_upload_video`

**手動で作成する必要はありません**（初回リクエスト時に自動作成）

---

## 🧪 テスト方法

### 1. レートリミットのテスト

**方法1: 実際に動画をアップロード**
1. LIFFアプリで動画をアップロード（10回）
2. 11回目でレートリミットエラーを確認
3. LINEで通知メッセージが届くことを確認

**方法2: Firestoreで手動テスト**
1. Firestore Console → `rate_limits`コレクション
2. テスト用ドキュメントを作成:
   ```
   {
     user_id: "test_user",
     action: "upload_video",
     request_times: ["2025-01-01T00:00:00", ... (10個)],
     last_updated: "2025-01-01T00:00:00",
     total_requests: 10
   }
   ```
3. 11回目のリクエストでレートリミットエラーを確認

---

### 2. Storageセキュリティルールのテスト

**テスト1: 未認証ユーザーのアップロード拒否**
- 認証なしでアップロードを試みる
- エラーが返されることを確認

**テスト2: 他ユーザーのファイルアクセス拒否**
- ユーザーAでログイン
- ユーザーBのファイルにアクセスを試みる
- エラーが返されることを確認

**テスト3: ファイル形式・サイズ制限**
- 100MB以上のファイルをアップロード
- 非動画ファイルをアップロード
- エラーが返されることを確認

---

## 📊 デプロイ後の確認事項

### ✅ 必須チェック

- [ ] Storageルールがデプロイされている
- [ ] Cloud Functionsが正常にデプロイされている
- [ ] レートリミット機能が動作している
- [ ] エラーログに異常がない

### ✅ オプションチェック

- [ ] GCP請求アラートを設定（`GCP_BILLING_ALERT.md`参照）
- [ ] ログ監視アラートを設定（`LOGGING_MONITORING.md`参照）

---

## 🐛 トラブルシューティング

### エラー: "Rate limit check failed"

**原因:** Firestoreへのアクセス権限がない

**解決:**
1. Firebase Console → Firestore Database → データ
2. デフォルトのルールを確認
3. Cloud Functionsからアクセス可能になっているか確認

**デフォルトルール例:**
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

---

### エラー: "Storage rule deployment failed"

**原因:** `storage.rules`の構文エラー

**解決:**
1. Firebase Console → Storage → ルール
2. エラーメッセージを確認
3. 構文を修正

---

### レートリミットが動作しない

**確認事項:**
1. Firestoreに`rate_limits`コレクションが作成されているか
2. Cloud Functionsのログでレートリミットチェックが実行されているか
3. `functions/rate_limiter.py`が正しくインポートされているか

---

## 📚 関連ドキュメント

- `SECURITY_GUIDE.md` - セキュリティ対策の詳細
- `GCP_BILLING_ALERT.md` - 請求アラート設定ガイド
- `LOGGING_MONITORING.md` - ログ監視設定ガイド

---

**最終更新:** 2025-01-XX
**作成者:** AI Assistant（Auto）

