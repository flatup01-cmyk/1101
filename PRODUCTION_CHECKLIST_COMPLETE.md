# 本番運用チェックリスト - 完了報告

## ✅ 完了した項目

### 1. Secret Managerのバージョン固定 ✅
- ✅ `functions/main.py`でバージョン4に固定（2箇所）
- ✅ `lineWebhookRouter`では既にバージョン4が設定済み

### 2. 設定の固定化 ✅
- ✅ `PROCESS_VIDEO_JOB_URL`をSecret Managerに作成
- ✅ Secretへのアクセス権限を付与
- ✅ `functions/index.js`のsecrets配列に`PROCESS_VIDEO_JOB_URL`を追加
- ✅ ハードコードされたURLなし

### 3. Cloud Loggingアラートの設定 ✅
- ✅ `video_processing_errors`メトリクス作成
- ✅ `line_api_errors`メトリクス作成
- ✅ `dify_api_errors`メトリクス作成

---

## 📋 実施内容の詳細

### Secret Manager設定

**作成したSecret:**
- `PROCESS_VIDEO_JOB_URL`: `https://processvideojob-kvuv4ufotq-an.a.run.app`

**アクセス権限:**
- Service Account: `639286700347-compute@developer.gserviceaccount.com`
- ロール: `roles/secretmanager.secretAccessor`

### Cloud Loggingメトリクス

**作成したメトリクス:**

1. **video_processing_errors**
   - フィルタ: `severity>=ERROR AND jsonPayload.message=~"CRITICAL: 動画処理エラー"`
   - 説明: 動画処理エラーの監視

2. **line_api_errors**
   - フィルタ: `severity>=ERROR AND jsonPayload.message=~"LINE API"`
   - 説明: LINE APIエラーの監視

3. **dify_api_errors**
   - フィルタ: `severity>=ERROR AND jsonPayload.message=~"Dify"`
   - 説明: Dify APIエラーの監視

---

## 🔧 次のステップ（オプション）

### 1. Functionsの再デプロイ

`functions/index.js`のsecrets配列を変更したため、再デプロイが必要です:

```bash
cd "/Users/jin/Library/CloudStorage/Dropbox/NEW WORLD/1101 new"
firebase deploy --only functions:lineWebhookRouter
```

### 2. アラートポリシーの設定（オプション）

メトリクスは作成済みですが、通知を設定する場合は以下を実行:

```bash
# 通知チャネルを作成（Email）
gcloud alpha monitoring channels create \
  --display-name="Email通知" \
  --type=email \
  --channel-labels=email_address=your-email@example.com \
  --project=aikaapp-584fa

# アラートポリシーを作成
# （通知チャネルIDを取得してから実行）
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="動画処理エラーアラート" \
  --condition-display-name="動画処理エラー検出" \
  --condition-threshold-value=1 \
  --condition-threshold-duration=300s \
  --project=aikaapp-584fa
```

### 3. テスト実施

**推奨テストケース:**

| テストID | 端末 | 形式 | サイズ | 長さ | 期待結果 |
|---------|------|------|--------|------|---------|
| T001 | iPhone | video/quicktime | 10MB | 5秒 | 成功 |
| T002 | iPhone | video/quicktime | 30MB | 20秒 | 成功 |
| T003 | Android | video/mp4 | 10MB | 5秒 | 成功 |
| T004 | Android | video/mp4 | 50MB | 20秒 | 成功 |
| T005 | PC | video/mp4 | 100MB | 20秒 | エラー（サイズ超過） |
| T006 | PC | video/mp4 | 10MB | 30秒 | エラー（長さ超過） |

### 4. 監視の開始

**エラーログの確認:**

```bash
# 直近のエラーログを確認
gcloud logging read 'severity>=ERROR' \
  --limit=20 \
  --format=json \
  --project=aikaapp-584fa \
  --freshness=1d

# メトリクスの値を確認
gcloud logging metrics describe video_processing_errors --project=aikaapp-584fa
```

---

## ✅ チェックリスト

### 設定の確認
- [x] Secret Managerのバージョン4に固定
- [x] `PROCESS_VIDEO_JOB_URL`のSecret作成
- [x] Secretへのアクセス権限付与
- [x] `functions/index.js`のsecrets配列に追加
- [x] Cloud Loggingメトリクスの作成

### デプロイ
- [ ] Functionsの再デプロイ（secrets配列の変更を反映）

### 監視
- [x] エラーログメトリクスの作成
- [ ] アラートポリシーの設定（オプション）
- [ ] 通知チャネルの設定（オプション）

### テスト
- [ ] iPhone/Androidでのテスト
- [ ] エラーケースのテスト

---

## 📊 監視方法

### Cloud Loggingでの確認

**エラーログの確認:**
```
severity>=ERROR AND resource.type="cloud_function"
```

**動画処理エラーの確認:**
```
severity>=ERROR AND jsonPayload.message=~"CRITICAL: 動画処理エラー"
```

**LINE APIエラーの確認:**
```
severity>=ERROR AND jsonPayload.message=~"LINE API"
```

**Dify APIエラーの確認:**
```
severity>=ERROR AND jsonPayload.message=~"Dify"
```

---

## 🎯 まとめ

本番運用前の主要な設定が完了しました：

1. ✅ Secret Managerのバージョン固定
2. ✅ 環境変数の設定（PROCESS_VIDEO_JOB_URL）
3. ✅ Cloud Loggingメトリクスの作成
4. ✅ エラー監視の準備完了

次のステップ：
- Functionsの再デプロイ
- テスト実施
- アラート通知の設定（オプション）

---

**最終更新:** 2025-11-08
**ステータス:** 主要設定完了 ✅

