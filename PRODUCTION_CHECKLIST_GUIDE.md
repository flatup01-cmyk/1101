# 本番運用チェックリスト - 実施ガイド

## ✅ 完了した項目

### 1. Secret Managerのバージョン固定
- ✅ `functions/main.py`でバージョン4に固定
- ✅ `lineWebhookRouter`では既にバージョン4が設定済み

### 2. 設定の固定化
- ✅ `PROCESS_VIDEO_JOB_URL`は環境変数から読み込み（`functions/index.js`）
- ✅ ハードコードされたURLなし

---

## 🔧 実施が必要な項目

### 1. PROCESS_VIDEO_JOB_URLの環境変数設定

**現在の状態:**
- `functions/index.js`で`process.env.PROCESS_VIDEO_JOB_URL`から読み込み
- 環境変数が設定されていない可能性

**設定手順:**

```bash
# Firebase Functions Gen2の場合、環境変数は直接設定できないため、
# Secret ManagerまたはCloud Runの環境変数として設定する必要があります

# 方法1: Secret Managerに保存（推奨）
echo -n "https://processvideojob-kvuv4ufotq-an.a.run.app" | \
  gcloud secrets create PROCESS_VIDEO_JOB_URL \
  --data-file=- \
  --project=aikaapp-584fa

# 方法2: Cloud Runの環境変数として設定（functions/index.jsのsecretsに追加）
# functions/index.jsのlineWebhookRouterのsecrets配列に追加:
# secrets: ["MAKE_WEBHOOK_URL", "LINE_CHANNEL_ACCESS_TOKEN", "PROCESS_VIDEO_JOB_URL", ...]
```

**確認コマンド:**

```bash
# Secret Managerのシークレット一覧を確認
gcloud secrets list --project=aikaapp-584fa | grep PROCESS_VIDEO_JOB_URL
```

---

### 2. Cloud Loggingアラートの設定

**手順1: ログメトリクスの作成**

```bash
# 動画処理エラーのメトリクス
gcloud logging metrics create video_processing_errors \
  --description="動画処理エラーの監視" \
  --log-filter='severity>=ERROR AND jsonPayload.message=~"CRITICAL: 動画処理エラー"' \
  --project=aikaapp-584fa

# LINE APIエラーのメトリクス
gcloud logging metrics create line_api_errors \
  --description="LINE APIエラーの監視" \
  --log-filter='severity>=ERROR AND jsonPayload.message=~"LINE API"' \
  --project=aikaapp-584fa

# Dify APIエラーのメトリクス
gcloud logging metrics create dify_api_errors \
  --description="Dify APIエラーの監視" \
  --log-filter='severity>=ERROR AND jsonPayload.message=~"Dify"' \
  --project=aikaapp-584fa
```

**手順2: 通知チャネルの作成**

```bash
# Email通知チャネルを作成
gcloud alpha monitoring channels create \
  --display-name="Email通知" \
  --type=email \
  --channel-labels=email_address=your-email@example.com \
  --project=aikaapp-584fa
```

**手順3: アラートポリシーの作成**

```bash
# 動画処理エラーアラート
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="動画処理エラーアラート" \
  --condition-display-name="動画処理エラー検出" \
  --condition-threshold-value=1 \
  --condition-threshold-duration=300s \
  --project=aikaapp-584fa
```

**簡易確認方法（アラート設定前）:**

```bash
# 直近のエラーログを確認
gcloud logging read 'severity>=ERROR' \
  --limit=20 \
  --format=json \
  --project=aikaapp-584fa \
  --freshness=1d
```

---

### 3. 料金と上限の確認

**Cloud Functions/Cloud Runの設定確認:**

```bash
# 現在の設定を確認
gcloud functions describe process_video_trigger \
  --gen2 \
  --region=asia-northeast1 \
  --format="yaml(serviceConfig.maxInstanceCount,serviceConfig.timeoutSeconds,serviceConfig.availableMemory)" \
  --project=aikaapp-584fa

# または、lineWebhookRouterとprocessVideoJobの設定を確認
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
```

**クォータの確認:**

```bash
# Cloud Functionsのクォータを確認
gcloud compute project-info describe \
  --project=aikaapp-584fa \
  --format="value(quotas)" | grep -i "function\|run\|concurrent"

# APIクォータを確認
gcloud services list --enabled --project=aikaapp-584fa
```

**予算アラートの設定:**

```bash
# 請求アカウントIDを確認
gcloud billing accounts list

# 予算アラートを作成（請求アカウントIDを置き換える）
gcloud billing budgets create \
  --billing-account=BILLING_ACCOUNT_ID \
  --display-name="GCS Storage予算アラート" \
  --budget-amount=10000 \
  --threshold-rule=percent=80 \
  --threshold-rule=percent=100 \
  --project=aikaapp-584fa
```

---

### 4. レート制御の確認

**現在の実装:**

`functions/rate_limiter.py`で既に実装済み:
- ユーザーごとのアップロード制限
- 時間単位の制限

**確認コマンド:**

```bash
# Firestoreでレート制限の設定を確認
# （コード内で確認する必要があります）
```

**テスト方法:**

1. 同じユーザーで連続してアップロードを試行
2. レート制限が機能しているか確認
3. エラーメッセージが適切に表示されるか確認

---

## 📋 テスト計画

### 端末/形式のテスト

**テストケース:**

| テストID | 端末 | 形式 | サイズ | 長さ | 期待結果 |
|---------|------|------|--------|------|---------|
| T001 | iPhone | video/quicktime | 10MB | 5秒 | 成功 |
| T002 | iPhone | video/quicktime | 30MB | 20秒 | 成功 |
| T003 | Android | video/mp4 | 10MB | 5秒 | 成功 |
| T004 | Android | video/mp4 | 50MB | 20秒 | 成功 |
| T005 | PC | video/mp4 | 100MB | 20秒 | エラー（サイズ超過） |
| T006 | PC | video/mp4 | 10MB | 30秒 | エラー（長さ超過） |

**テスト手順:**

1. LIFFアプリから動画をアップロード
2. Cloud Functionsのログで処理状況を確認
3. LINE Botからメッセージが届くか確認
4. Firestoreに解析結果が保存されるか確認

---

## ✅ チェックリスト

### 設定の確認
- [x] Secret Managerのバージョン4に固定
- [ ] `PROCESS_VIDEO_JOB_URL`の環境変数設定
- [ ] Cloud Loggingアラートの設定
- [ ] 予算アラートの設定

### テスト
- [ ] iPhone (video/quicktime, 5秒) - 成功
- [ ] iPhone (video/quicktime, 20秒) - 成功
- [ ] Android (video/mp4, 5秒) - 成功
- [ ] Android (video/mp4, 20秒) - 成功
- [ ] エラーケース（100MB超過） - 適切なエラーメッセージ
- [ ] エラーケース（20秒超過） - 適切なエラーメッセージ

### UX確認
- [ ] LIFF認証が正常に動作
- [ ] 動画アップロードフォームが表示される
- [ ] 進捗表示が適切に更新される
- [ ] エラーメッセージが分かりやすい
- [ ] LINE Bot応答が適切

### 監視
- [ ] エラーログの確認方法を理解
- [ ] アラート通知が設定されている
- [ ] 処理件数の確認方法を理解

---

**最終更新:** 2025-11-08
**ステータス:** 実施中

