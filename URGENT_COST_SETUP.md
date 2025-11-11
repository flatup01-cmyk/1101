# 🚨 コスト管理設定の緊急対応ガイド

## 📊 現在の状況（確認結果）

### ✅ 正常な項目
- **Storage使用量**: 150.24 MiB（約0.15GB）→ **2.5GB以下なので安全**

### ❌ 設定が必要な項目
1. **Cloud Schedulerジョブ** (`cleanup-storage-daily`) → **未設定**
2. **Cloud Functions** (`cleanup_storage_http`) → **未デプロイ**
3. **GCP予算とアラート** → **未設定**

---

## 🔧 緊急設定手順

### ステップ1: 自動削除機能のデプロイと設定

#### 1-1. Cloud Functionsをデプロイ

```bash
cd /Users/jin/.cursor/worktrees/1101_new/CUN3L

# cleanup_storage_http関数をデプロイ
firebase deploy --only functions:cleanup_storage_http
```

**注意**: もし`cleanup_storage_http`が`firebase.json`に定義されていない場合、以下のコマンドで直接デプロイ：

```bash
gcloud functions deploy cleanup_storage_http \
  --gen2 \
  --runtime=python312 \
  --region=asia-northeast1 \
  --source=./functions \
  --entry-point=cleanup_storage_http \
  --trigger-http \
  --allow-unauthenticated \
  --project=aikaapp-584fa
```

#### 1-2. Cloud Schedulerジョブを作成

```bash
# 関数のURLを取得（デプロイ後に表示されるURLを使用）
FUNCTION_URL="https://asia-northeast1-aikaapp-584fa.cloudfunctions.net/cleanup_storage_http"

# Cloud Schedulerジョブを作成
gcloud scheduler jobs create http cleanup-storage-daily \
  --location=asia-northeast1 \
  --schedule="0 2 * * *" \
  --time-zone="Asia/Tokyo" \
  --uri="$FUNCTION_URL" \
  --http-method=GET \
  --oidc-service-account-email=639286700347-compute@developer.gserviceaccount.com \
  --project=aikaapp-584fa
```

**確認**:
```bash
gcloud scheduler jobs describe cleanup-storage-daily \
  --location=asia-northeast1 \
  --project=aikaapp-584fa
```

---

### ステップ2: GCP予算とアラートの設定

#### 2-1. GCP Consoleで設定（推奨）

1. **[GCP Console - 予算とアラート](https://console.cloud.google.com/billing/budgets)** にアクセス
2. プロジェクト `aikaapp-584fa` を選択
3. **「予算を作成」** をクリック

#### 2-2. 予算設定

- **予算名**: `aikaapp-monthly-budget`
- **予算額**: `5000` 円/月（初期設定）
- **期間**: 月次
- **スコープ**: このプロジェクトのみ

#### 2-3. アラート設定

以下のしきい値を追加：

| しきい値 | アクション |
|---------|----------|
| 50% | メール通知 |
| 80% | メール通知 |
| 100% | メール通知 + 予算超過アクション（オプション） |

#### 2-4. 通知先設定

- **メールアドレス**: あなたのメールアドレスを入力
- **通知ルール**: 「予算のしきい値に達したとき」「予算を超過したとき」にチェック

#### 2-5. 予算を保存

設定を確認して「予算を作成」をクリック

---

### ステップ3: 動作確認

#### 3-1. 自動削除機能のテスト

```bash
# 手動で関数を実行（テスト）
curl https://asia-northeast1-aikaapp-584fa.cloudfunctions.net/cleanup_storage_http

# 実行ログを確認
gcloud functions logs read cleanup_storage_http \
  --region=asia-northeast1 \
  --project=aikaapp-584fa \
  --limit=10
```

#### 3-2. Cloud Schedulerジョブのテスト

```bash
# ジョブを手動実行（テスト）
gcloud scheduler jobs run cleanup-storage-daily \
  --location=asia-northeast1 \
  --project=aikaapp-584fa

# 実行履歴を確認
gcloud scheduler jobs describe cleanup-storage-daily \
  --location=asia-northeast1 \
  --project=aikaapp-584fa
```

#### 3-3. 予算アラートの確認

1. [GCP Console - 予算とアラート](https://console.cloud.google.com/billing/budgets) にアクセス
2. 作成した予算を選択
3. 「アラート履歴」タブで通知が正しく設定されているか確認

---

## 📋 設定完了後の確認

以下のコマンドで設定状況を再確認：

```bash
./check_cost_settings.sh
```

**期待される出力**:
- ✅ Cloud Schedulerジョブ `cleanup-storage-daily` が表示される
- ✅ Cloud Functions `cleanup_storage_http` が表示される
- ✅ 予算が設定されている

---

## 💡 定期確認の推奨事項

### 毎週確認すべき項目

1. **Storage使用量**
   ```bash
   gsutil du -sh gs://aikaapp-584fa.firebasestorage.app/videos/
   ```
   - 2.5GB以下: ✅ 正常
   - 2.5GB超: ⚠️ 自動削除が動作していない可能性

2. **予算の使用状況**
   - [GCP Console](https://console.cloud.google.com/billing/budgets) で確認
   - 50%を超えたら注意

3. **Cloud Schedulerの実行ログ**
   ```bash
   gcloud scheduler jobs describe cleanup-storage-daily \
     --location=asia-northeast1 \
     --project=aikaapp-584fa
   ```

---

## 🚨 緊急時の対応

### Storage使用量が急増した場合

1. **手動で自動削除を実行**:
   ```bash
   curl https://asia-northeast1-aikaapp-584fa.cloudfunctions.net/cleanup_storage_http
   ```

2. **古い動画を手動削除**（必要に応じて）:
   ```bash
   # 30日以上経過した動画を確認
   gsutil ls -l gs://aikaapp-584fa.firebasestorage.app/videos/
   
   # 削除（注意: 実行前に確認）
   gsutil rm gs://aikaapp-584fa.firebasestorage.app/videos/old-video.mp4
   ```

### 予算超過のリスクがある場合

1. **予算を増額**:
   - GCP Console → 予算とアラート → 予算を編集

2. **使用量を削減**:
   - 不要なCloud Functionsを削除
   - 古いStorageファイルを削除
   - レートリミットを強化

---

## ✅ 設定チェックリスト

- [ ] `cleanup_storage_http` 関数がデプロイされている
- [ ] Cloud Schedulerジョブ `cleanup-storage-daily` が作成されている
- [ ] ジョブが有効になっている
- [ ] GCP予算が設定されている（月額5,000円）
- [ ] 50%アラートが設定されている
- [ ] 80%アラートが設定されている
- [ ] 100%アラートが設定されている
- [ ] 通知先メールアドレスが設定されている
- [ ] 動作確認が完了している

---

**重要**: これらの設定を完了するまで、定期的にStorage使用量と予算の使用状況を手動で確認してください。

