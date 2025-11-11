# 本番運用チェックリスト - 実施状況

## ✅ 完了した項目

### 1. Secret Managerのバージョン固定 ✅
- ✅ `functions/main.py`でバージョン4に固定（2箇所）
- ✅ `lineWebhookRouter`では既にバージョン4が設定済み

### 2. 設定の固定化 ✅
- ✅ `PROCESS_VIDEO_JOB_URL`をSecret Managerに追加する準備完了
- ✅ `functions/index.js`のsecrets配列に`PROCESS_VIDEO_JOB_URL`を追加
- ✅ ハードコードされたURLなし

---

## 🔧 実施が必要な項目

### 1. PROCESS_VIDEO_JOB_URLのSecret作成

**実施コマンド:**

```bash
# Secret ManagerにPROCESS_VIDEO_JOB_URLを作成
echo -n "https://processvideojob-kvuv4ufotq-an.a.run.app" | \
  gcloud secrets create PROCESS_VIDEO_JOB_URL \
  --data-file=- \
  --project=aikaapp-584fa

# Secretへのアクセス権限を付与（既に設定済みの可能性あり）
gcloud secrets add-iam-policy-binding PROCESS_VIDEO_JOB_URL \
  --member="serviceAccount:639286700347-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project=aikaapp-584fa
```

**確認:**

```bash
# Secretが作成されたか確認
gcloud secrets describe PROCESS_VIDEO_JOB_URL --project=aikaapp-584fa

# Functionsを再デプロイ（secrets配列の変更を反映）
cd "/Users/jin/Library/CloudStorage/Dropbox/NEW WORLD/1101 new"
firebase deploy --only functions:lineWebhookRouter
```

---

### 2. Cloud Loggingアラートの設定

**実施コマンド:**

```bash
# 1. ログメトリクスの作成
gcloud logging metrics create video_processing_errors \
  --description="動画処理エラーの監視" \
  --log-filter='severity>=ERROR AND jsonPayload.message=~"CRITICAL: 動画処理エラー"' \
  --project=aikaapp-584fa

gcloud logging metrics create line_api_errors \
  --description="LINE APIエラーの監視" \
  --log-filter='severity>=ERROR AND jsonPayload.message=~"LINE API"' \
  --project=aikaapp-584fa

gcloud logging metrics create dify_api_errors \
  --description="Dify APIエラーの監視" \
  --log-filter='severity>=ERROR AND jsonPayload.message=~"Dify"' \
  --project=aikaapp-584fa

# 2. メトリクスの確認
gcloud logging metrics list --project=aikaapp-584fa
```

**通知チャネルの作成（オプション）:**

```bash
# Email通知チャネルを作成
# 注意: このコマンドは実際のメールアドレスに置き換える必要があります
gcloud alpha monitoring channels create \
  --display-name="Email通知" \
  --type=email \
  --channel-labels=email_address=your-email@example.com \
  --project=aikaapp-584fa
```

---

### 3. 料金と上限の確認

**実施コマンド:**

```bash
# Cloud Functionsの設定確認
gcloud functions describe lineWebhookRouter \
  --gen2 \
  --region=asia-northeast1 \
  --format="yaml(serviceConfig.maxInstanceCount,serviceConfig.timeoutSeconds,serviceConfig.availableMemory)" \
  --project=aikaapp-584fa

gcloud functions describe processVideoJob \
  --gen2 \
  --region=asia-northeast1 \
  --format="yaml(serviceConfig.maxInstanceCount,serviceConfig.timeoutSeconds,serviceConfig.availableMemory)" \
  --project=aikaapp-584fa

# クォータの確認
gcloud compute project-info describe \
  --project=aikaapp-584fa \
  --format="value(quotas)" | grep -i "function\|run\|concurrent"
```

---

## 📋 次のステップ

1. **PROCESS_VIDEO_JOB_URLのSecret作成**
   - 上記のコマンドを実行
   - Functionsを再デプロイ

2. **Cloud Loggingアラートの設定**
   - ログメトリクスを作成
   - 通知チャネルを設定（オプション）

3. **テスト実施**
   - iPhone/Androidでのテスト
   - エラーケースのテスト

4. **監視開始**
   - エラーログの定期確認
   - アラート通知の確認

---

**最終更新:** 2025-11-08
**ステータス:** 準備完了、実施待ち

