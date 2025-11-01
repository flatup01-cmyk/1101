# 🧹 Firebase Storage自動削除機能セットアップガイド

## 📋 概要

Firebase Storageの使用量が2.5GB（無料枠5GBの半分）を超えた場合、自動的に古い動画を削除して容量を管理します。

## ✅ 実装済み機能

1. **容量ベースの自動削除**
   - Storage使用量が2.5GBを超えた場合、古い動画から順に削除
   - 2.5GB以下になるまで継続的に削除

2. **日付ベースの自動削除**
   - 30日以上経過した動画を自動削除
   - 解析結果は既にLINEで送信済みのため、安全に削除可能

## 📁 作成したファイル

- `functions/cleanup_storage.py` - 自動削除関数

## 🔧 セットアップ手順

### ステップ1: Cloud Functionsをデプロイ

```bash
cd "/Users/jin/Library/CloudStorage/Dropbox/NEW WORLD/1101 new"
firebase deploy --only functions
```

### ステップ2: Cloud Schedulerで定期実行を設定

Firebase Consoleから設定：

1. **Google Cloud Consoleにアクセス**
   - https://console.cloud.google.com/cloudscheduler
   - プロジェクト: `aikaapp-584fa` を選択

2. **新しいジョブを作成**
   - 「ジョブを作成」をクリック

3. **ジョブ設定**
   - **名前**: `cleanup-storage-daily`
   - **説明**: 毎日Storageの自動削除を実行
   - **頻度**: `0 2 * * *` （毎日午前2時に実行）
   - **タイムゾーン**: `Asia/Tokyo`

4. **ターゲットタイプ**: HTTP

5. **URL設定**
   - Cloud Functionsをデプロイ後、以下のURLを確認：
   ```
   https://asia-northeast1-aikaapp-584fa.cloudfunctions.net/cleanup_storage_http
   ```
   - 実際のURLは `firebase deploy --only functions` 実行後の出力を確認

6. **HTTPメソッド**: GET

7. **認証**: 「認証ヘッダーの追加」を選択
   - 認証タイプ: OIDC トークン
   - サービスアカウント: `appspot-compute@aikaapp-584fa.iam.gserviceaccount.com`

### ステップ3: 環境変数の設定（オプション）

デフォルト値：
- `STORAGE_LIMIT_MB`: `2560` (2.5GB)
- `DELETE_AGE_DAYS`: `30` (30日)

変更したい場合：

```bash
firebase functions:config:set \
  storage.limit_mb=2560 \
  storage.delete_age_days=30

firebase deploy --only functions
```

### ステップ4: 動作確認

#### 方法1: 手動実行（テスト）

Google Cloud Consoleから：

1. Cloud Functions → `cleanup_storage_http` を選択
2. 「テスト」タブ → 「関数を呼び出す」をクリック
3. ログを確認

#### 方法2: コマンドラインから実行

```bash
curl https://asia-northeast1-aikaapp-584fa.cloudfunctions.net/cleanup_storage_http
```

## 📊 動作の仕組み

### 削除の優先順位

1. **30日以上経過した動画** → 自動削除
2. **容量が2.5GBを超えた場合** → 古い動画から順に削除

### 削除対象外

- 30日以内の動画で、容量制限内のものは削除されません
- ユーザーが手動で削除した場合は、そのまま削除されます

## 💰 コスト影響

### Cloud Functions実行コスト

- **実行頻度**: 1日1回（毎日午前2時）
- **実行時間**: 約10-30秒（動画数による）
- **無料枠**: 月200万回まで無料
- **実コスト**: **$0（無料枠内）**

### 削除によるStorage削減

- 2.5GBを超えた分が自動削除されます
- 無料枠5GBを超えないように管理されます

## ⚠️ 注意事項

1. **解析結果は既にLINEで送信済み**
   - 動画は解析後に自動削除されても問題ありません
   - ユーザーは既に解析結果を受け取っています

2. **30日以内の動画は保護**
   - 容量制限内であれば、30日以内の動画は削除されません

3. **緊急時の手動削除**
   - Firebase Console → Storage から手動で削除可能
   - 自動削除を一時停止したい場合は、Cloud Schedulerジョブを無効化

## 🔍 ログの確認方法

1. **Firebase Console**
   - Functions → ログ
   - `cleanup_storage_http` のログを確認

2. **実行ログ例**
   ```
   🧹 Storage自動削除処理を開始します...
   📊 現在のStorage使用量: 2800.50MB
   📊 制限値: 2560MB
   🗑️  削除予定（容量超過）: videos/user123/1234567890-video.mp4 (100.50MB)
   ✅ 削除完了: videos/user123/1234567890-video.mp4
   ✅ 削除処理完了:
      - 削除前: 2800.50MB
      - 削除後: 2500.00MB
      - 削除数: 3個
      - 削除容量: 300.50MB
   ```

## 🚨 トラブルシューティング

### エラー1: 関数が見つからない

**原因**: Functionsがデプロイされていない

**解決策**:
```bash
firebase deploy --only functions
```

### エラー2: 認証エラー

**原因**: Cloud Schedulerの認証設定が不正

**解決策**:
- Cloud Schedulerジョブの認証設定を確認
- OIDCトークンを使用しているか確認

### エラー3: 削除が実行されない

**原因**: 容量が制限内で、30日経過した動画がない

**解決策**:
- これは正常な動作です
- ログで「削除対象なし」と表示されます

## ✅ チェックリスト

- [ ] `functions/cleanup_storage.py` が作成されている
- [ ] Cloud Functionsをデプロイ済み
- [ ] Cloud Schedulerジョブを作成済み
- [ ] 環境変数を設定済み（オプション）
- [ ] 手動実行で動作確認済み
- [ ] ログで正常動作を確認済み

## 📚 関連ドキュメント

- `APP_PUBLICATION_WARNING.md` - Storage料金の詳細
- `GCP_BILLING_ALERT.md` - 請求アラート設定
- `SETUP_REMAINING_STEPS.md` - 全体のセットアップ手順

---

**最終更新**: 2025-01-XX  
**作成者**: AI Assistant (Auto)

