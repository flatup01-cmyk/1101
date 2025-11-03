# 🔧 Firebase設定確認ガイド

## ✅ 修正完了項目

1. **Firestore Rules修正**
   - 匿名認証ユーザーが`firebaseUid`フィールドでジョブを読み取り可能に
   - 後方互換性のため`userId`フィールドもチェック

2. **Storage Rules修正**
   - 匿名認証でも確実に動作するように簡素化
   - `request.auth.uid == firebaseUid` でチェック

3. **エラーハンドリング改善**
   - より詳細なエラーメッセージ
   - 認証状態の確認を強化

## 🔍 Firebase設定確認手順

### 1. 匿名認証の有効化確認

1. [Firebase Console](https://console.firebase.google.com/project/aikaapp-584fa/authentication/providers) にアクセス
2. **Authentication** → **Sign-in method** を開く
3. **Anonymous** を確認
   - ✅ **Enabled** になっているか確認
   - 無効な場合は **Enable** をクリック

### 2. Storage Rules確認

1. **Storage** → **Rules** タブを開く
2. 以下のルールがデプロイされているか確認：

```firebase
match /videos/{firebaseUid}/{jobId}/{filename} {
  allow write: if request.auth != null
               && request.auth.uid == firebaseUid
               && filename.matches('.*\\.(mp4|mov|avi|mkv|MP4|MOV|AVI|MKV)$')
               && request.resource.size < 100 * 1024 * 1024;
  
  allow read: if request.auth != null
              && request.auth.uid == firebaseUid;
}
```

### 3. Firestore Rules確認

1. **Firestore Database** → **Rules** タブを開く
2. 以下のルールがデプロイされているか確認：

```firebase
match /video_jobs/{jobId} {
  allow create: if request.auth != null;
  
  allow read: if request.auth != null 
              && (request.auth.uid == resource.data.firebaseUid 
                  || request.auth.uid == resource.data.userId);
}
```

## 📱 テスト手順

### モバイル端末でのテスト

1. **LINEアプリでLIFFを開く**
   - または `?dev=true` パラメータで開発モードでテスト

2. **ブラウザの開発者ツールでログを確認**
   - iPhone: Safari → 開発 → デバイス名 → ウェブインスペクタ
   - Android: Chrome → chrome://inspect

3. **確認すべきログ**
   ```
   ✅ Firebase Core Services Initialized
   ✅ Anonymous Auth Success
   📋 Current user: [UID]
   📝 Creating job - Firebase UID: [UID], LIFF User ID: [UID]
   ✅ Job created in Firestore with ID: [ID]
   🚀 Starting upload for job [ID] to videos/[UID]/[ID]/[filename]
   📊 Upload progress: X%
   ✅ Upload complete for job [ID]
   ```

4. **エラーが出た場合**
   - エラーメッセージをコピー
   - コンソールログの全内容を確認
   - Firebase Consoleの **Firestore** → **Logs** を確認

## ⚠️ よくあるエラーと対処法

### エラー1: `permission-denied`
**原因**: 匿名認証が有効になっていない、またはルールが正しくデプロイされていない

**対処**:
1. Firebase Consoleで匿名認証を有効化
2. `firebase deploy --only firestore:rules,storage` を実行

### エラー2: `storage/unauthorized`
**原因**: Storage Rulesで認証チェックが失敗

**対処**:
1. ブラウザのコンソールで `auth.currentUser` を確認
2. Firebase UIDが正しく取得できているか確認
3. Storage Rulesのパス構造が一致しているか確認

### エラー3: `Firestore接続タイムアウト`
**原因**: ネットワークが遅い、またはFirestoreサービスが利用できない

**対処**:
1. ネットワーク接続を確認
2. Firebase ConsoleでFirestoreサービスの状態を確認
3. リトライ

## 🔄 デプロイ状況

- ✅ Storage Rules: デプロイ完了
- ✅ Firestore Rules: デプロイ完了
- ✅ フロントエンドコード: GitHubにプッシュ完了（Netlifyで自動デプロイ中）

## 📞 次のステップ

Netlifyのデプロイが完了したら（約2-3分）:
1. モバイル端末で再度テスト
2. エラーが出た場合は、コンソールログの内容を共有してください

