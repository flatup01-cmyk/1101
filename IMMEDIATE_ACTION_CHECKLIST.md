# 即実行チェックリスト

## ✅ 完了済み
- [x] 診断ログ追加（Node.js/Python両方）
- [x] パス検証修正（videos/{userId}/{messageId}.mp4対応）
- [x] processVideoJob再デプロイ（リビジョン: processvideojob-00045-fet）
- [x] lineWebhookRouter再デプロイ

## 🔧 今すぐ実行

### 1. Secret ManagerでDIFY_API_KEYを再保存（手入力）

```bash
# 現在のシークレットを確認（表示のみ）
gcloud secrets versions access latest --secret="DIFY_API_KEY" --project=aikaapp-584fa

# 新しいシークレットバージョンを作成（手入力、末尾改行・空白・全角・不可視文字ゼロ）
# WorkspaceのAPIキーを使用（app-で始まるアプリキーではなく、通常APIキー）
echo -n "YOUR_CLEAN_API_KEY_HERE" | gcloud secrets versions add DIFY_API_KEY --data-file=- --project=aikaapp-584fa

# 確認（長さと先頭文字のみ）
gcloud secrets versions access latest --secret="DIFY_API_KEY" --project=aikaapp-584fa | wc -c
gcloud secrets versions access latest --secret="DIFY_API_KEY" --project=aikaapp-584fa | head -c 10
```

### 2. process-video-triggerを再デプロイ

```bash
cd /Users/jin/new-kingdom
./deploy.sh
```

## 📊 テスト手順

1. **テキスト1件** → lineWebhookRouterログ確認
2. **画像1枚** → lineWebhookRouterログ確認
3. **動画20秒** → 3つのログを並べて確認：
   - lineWebhookRouter（受付→保存→署名URL→processVideoJob呼び出し）
   - processVideoJob（🔑 APIキー検証、✅ サニタイズ成功、🔍 [診断] Authorizationヘッダー検査）
   - process-video-trigger（🔍 [診断] Authorizationヘッダー検査、latin-1完全消滅）

## ✅ 成功判定

- [ ] テキスト・画像・動画の3パターンで「Difyの本文応答」が届く
- [ ] ログから ERR_INVALID_CHAR と latin-1 が完全消滅
- [ ] 失敗時でもフォールバックの送信ログが必ず出る（UX担保）

## 🔍 診断ログの確認ポイント

### Node.js側（processVideoJob）
```
🔑 APIキー検証: 長さ=XX, 先頭10文字=app***XX...
✅ APIキーサニタイズ成功: 長さ=XX
🔍 [診断] Authorizationヘッダー検査: len=XX, asciiOnly=true
```

### Python側（process-video-trigger）
```
🔑 APIキー検証: 長さ=XX, 先頭10文字=app***XX...
✅ APIキーサニタイズ成功: 長さ=XX
🔍 [診断] Authorizationヘッダー検査: len=XX, asciiOnly=true
🔍 [診断] リクエスト送信: url=..., headers=[...]
🔍 [診断] レスポンス受信: status=200
```

## ⚠️ エラー時の確認

- `asciiOnly=false` → Secret Managerで再保存が必要
- `ERR_INVALID_CHAR` → ヘッダーに非ASCII文字が残っている
- `latin-1` → Python側のエンコーディング問題（既に修正済み）

