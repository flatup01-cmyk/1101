# prodエイリアス設定ガイド

## 現在の状態
- ✅ Secret Manager: バージョン10に正しいAPIキーが保存済み
- ✅ Cloud Run: prodエイリアスを参照するように設定済み（リビジョン: process-video-trigger-00017-zj9）
- ⚠️ 未完了: prodエイリアスがバージョン10に未設定

## 設定手順

### Google Cloud Consoleで設定（推奨）

1. **Secret Manager Consoleを開く**
   ```
   https://console.cloud.google.com/security/secret-manager/secret/DIFY_API_KEY/versions/10?project=aikaapp-584fa
   ```

2. **「エイリアスを追加」をクリック**

3. **エイリアス名を入力**
   - エイリアス名: `prod`

4. **「保存」をクリック**

### 設定確認

```bash
gcloud secrets versions list DIFY_API_KEY --project=aikaapp-584fa --format='table(name,state,createTime,aliases)' --limit=5
```

**期待結果**: バージョン10の行に「prod」が表示される

## 重要なポイント

- **再デプロイは不要**: Cloud Runは既にprodエイリアスを参照するように設定済み
- **自動反映**: エイリアス設定後、次のリクエストから自動的にバージョン10の正しいAPIキーが使用されます
- **即座に有効**: エイリアス設定後、すぐに動作テストが可能です

## 最終テスト

エイリアス設定後:

1. **動画をアップロード**
2. **ログ確認**: `./check_auth_status.sh`
3. **期待されるログ**:
   - ✅ 🔑 APIキー検証: 長さ=XX, 先頭10文字=app***XX...
   - ✅ ✅ APIキーサニタイズ成功: 長さ=XX
   - ✅ 🔍 [診断] Authorizationヘッダー検査: len=XX, asciiOnly=true
   - ✅ ✅ Dify API呼び出し成功: status=200
