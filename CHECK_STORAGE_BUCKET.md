# 🔍 Firebase Storageバケット確認ガイド

## ❌ エラー: バケットが見つからない

```
BucketNotFoundException: 404 gs://aikaapp-584fa.appspot.com bucket does not exist.
```

---

## ✅ 解決手順

### ステップ1: Firebase ConsoleでStorageを確認

1. **Firebase Consoleにアクセス**
   - https://console.firebase.google.com/project/aikaapp-584fa/storage

2. **Storageが有効化されているか確認**
   - Storageが表示されている場合 → バケットは存在します
   - 「始める」ボタンが表示されている場合 → Storageを有効化する必要があります

### ステップ2: Storageを有効化（必要な場合）

1. **「始める」ボタンをクリック**

2. **セキュリティルールを選択**
   - 「テストモードで開始」または「本番モードで開始」
   - 既に`storage.rules`があるので、どちらでも構いません

3. **場所を選択**
   - デフォルトの場所で問題ありません
   - 「完了」をクリック

4. **バケット作成完了**
   - バケットが作成されます（通常、`[project-id].appspot.com`）

### ステップ3: バケット名を確認

Storage設定で実際のバケット名を確認：

1. **Firebase Console → Storage → 設定**
   - バケット名が表示されます

2. **または、Storageファイル一覧**
   - URLにバケット名が含まれています

### ステップ4: CORS設定を適用

バケット名を確認したら、CORS設定を適用：

```bash
# バケット名を確認（例: aikaapp-584fa.appspot.com）
gsutil cors set cors.json gs://[実際のバケット名]
```

---

## 🔍 バケット名の確認方法

### 方法1: Firebase Consoleから

1. Firebase Console → Storage
2. URLを確認: `console.firebase.google.com/project/aikaapp-584fa/storage/[bucket-name]/files`

### 方法2: gcloudコマンドで

```bash
# 全てのバケットを一覧表示
gsutil ls -p aikaapp-584fa
```

---

**最終更新:** 2025-01-XX  
**状態:** ⚠️ バケット確認が必要

