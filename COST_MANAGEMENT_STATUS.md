# 💰 コスト管理設定状況の確認と設定ガイド

## 📋 現在の実装状況

### ✅ 実装済み機能

1. **自動削除機能** (`functions/cleanup_storage.py`)
   - ✅ 容量が2.5GB（無料枠5GBの半分）を超えた場合、古い動画から順に削除
   - ✅ 30日以上経過した動画を自動削除
   - ⚠️ **要確認**: Cloud Schedulerで定期実行されているか

2. **コスト監視ドキュメント**
   - ✅ `GCP_BILLING_ALERT.md` - 予算とアラート設定ガイド
   - ⚠️ **要確認**: 実際に設定されているか

---

## 🔍 設定状況の確認方法

### 方法1: 確認スクリプトを実行

```bash
chmod +x check_cost_settings.sh
./check_cost_settings.sh
```

### 方法2: 手動確認

#### 1. Cloud Schedulerジョブの確認

```bash
gcloud scheduler jobs list --project=aikaapp-584fa --location=asia-northeast1
```

**期待される出力**:
```
NAME                    LOCATION        SCHEDULE      TIME_ZONE
cleanup-storage-daily   asia-northeast1 0 2 * * *    Asia/Tokyo
```

**存在しない場合**: `STORAGE_AUTO_CLEANUP_SETUP.md` の手順に従って設定してください。

#### 2. Cloud Functionsの確認

```bash
gcloud functions list --project=aikaapp-584fa --region=asia-northeast1 | grep cleanup
```

**期待される出力**:
```
cleanup_storage_http    asia-northeast1  HTTP
```

**存在しない場合**: 関数をデプロイしてください。

```bash
firebase deploy --only functions:cleanup_storage_http
```

#### 3. GCP予算の確認

1. [GCP Console](https://console.cloud.google.com/billing/budgets)にアクセス
2. プロジェクト `aikaapp-584fa` を選択
3. 「予算とアラート」を確認

**設定されていない場合**: `GCP_BILLING_ALERT.md` の手順に従って設定してください。

#### 4. Storage使用量の確認

```bash
gsutil du -sh gs://aikaapp-584fa.firebasestorage.app/videos/
```

**現在の使用量を確認**:
- 2.5GB以下: ✅ 正常
- 2.5GB超: ⚠️ 自動削除が動作していない可能性

---

## 🚨 必須設定項目

### 1. Cloud Schedulerジョブの設定（自動削除機能）

**設定手順**: `STORAGE_AUTO_CLEANUP_SETUP.md` を参照

**重要設定**:
- **名前**: `cleanup-storage-daily`
- **頻度**: `0 2 * * *` （毎日午前2時）
- **URL**: `https://asia-northeast1-aikaapp-584fa.cloudfunctions.net/cleanup_storage_http`

### 2. GCP予算とアラートの設定

**設定手順**: `GCP_BILLING_ALERT.md` を参照

**推奨設定**:
- **月額予算**: 5,000円（初期）
- **アラート**: 50%, 80%, 100%
- **通知先**: あなたのメールアドレス

### 3. Cloud Monitoringアラート（オプション）

**推奨アラート**:
- Storage使用量が1GB超過
- Cloud Functions実行回数が異常に多い
- Firestore読み取りが異常に多い

---

## 💡 コスト管理のベストプラクティス

### 1. 自動削除機能の動作確認

**定期的な確認**:
- 毎週、Storage使用量を確認
- Cloud Schedulerジョブの実行ログを確認
- 削除が正しく動作しているか確認

**確認コマンド**:
```bash
# Storage使用量
gsutil du -sh gs://aikaapp-584fa.firebasestorage.app/videos/

# Cloud Scheduler実行ログ
gcloud scheduler jobs describe cleanup-storage-daily \
  --project=aikaapp-584fa \
  --location=asia-northeast1

# Cloud Functions実行ログ
gcloud functions logs read cleanup_storage_http \
  --project=aikaapp-584fa \
  --region=asia-northeast1 \
  --limit=10
```

### 2. 予算アラートの確認

**定期的な確認**:
- 毎週、予算の使用状況を確認
- アラートメールが正しく届いているか確認
- 予算超過のリスクがないか確認

**確認方法**:
1. [GCP Console](https://console.cloud.google.com/billing/budgets)にアクセス
2. 予算の使用状況を確認
3. アラート履歴を確認

### 3. コスト最適化

**推奨事項**:
- 不要なCloud Functionsを削除
- 古いログを削除
- 不要なStorageファイルを削除
- レートリミットを適切に設定（既に実装済み）

---

## 📊 コスト見積もり

### 無料枠内で運用可能な範囲

| サービス | 無料枠 | 超過時の料金 |
|---------|--------|------------|
| Firebase Storage | 5GB/月 | 約4円/GB/月 |
| Cloud Functions | 200万回/月 | 約60円/100万回 |
| Firestore | 1GB/月 | 約180円/GB/月 |
| LINE Messaging API | 500通/月 | 約0.3円/通 |

### 想定コスト（月間）

**小規模運用（100ユーザー、1日10本の動画）**:
- Storage: 約1GB → **無料枠内**
- Functions: 約3,000回 → **無料枠内**
- LINE API: 約3,000通 → 約750円/月
- **合計**: 約750円/月

**中規模運用（1,000ユーザー、1日100本の動画）**:
- Storage: 約10GB → 約20円/月（5GB超過分）
- Functions: 約30,000回 → **無料枠内**
- LINE API: 約30,000通 → 約9,000円/月
- **合計**: 約9,020円/月

---

## ✅ チェックリスト

### 自動削除機能
- [ ] `cleanup_storage_http` 関数がデプロイされている
- [ ] Cloud Schedulerジョブ `cleanup-storage-daily` が作成されている
- [ ] ジョブが有効になっている
- [ ] ジョブが正しく実行されている（ログ確認）

### コスト監視
- [ ] GCP予算が設定されている（月額5,000円推奨）
- [ ] 50%アラートが設定されている
- [ ] 80%アラートが設定されている
- [ ] 100%アラートが設定されている
- [ ] 通知先メールアドレスが設定されている
- [ ] アラートメールが正しく届いている

### 定期確認
- [ ] 毎週、Storage使用量を確認
- [ ] 毎週、予算の使用状況を確認
- [ ] 毎週、Cloud Schedulerの実行ログを確認

---

## 🔧 緊急時の対応

### Storage使用量が急増した場合

1. **手動で削除**:
   ```bash
   # 古い動画を確認
   gsutil ls -l gs://aikaapp-584fa.firebasestorage.app/videos/
   
   # 古い動画を削除（注意: 実行前に確認）
   gsutil rm gs://aikaapp-584fa.firebasestorage.app/videos/old-video.mp4
   ```

2. **自動削除を手動実行**:
   ```bash
   curl https://asia-northeast1-aikaapp-584fa.cloudfunctions.net/cleanup_storage_http
   ```

3. **Cloud Schedulerジョブを確認**:
   - ジョブが無効になっていないか確認
   - ジョブの実行ログを確認

### 予算超過のリスクがある場合

1. **予算を増額**:
   - GCP Console → 予算とアラート → 予算を編集

2. **使用量を削減**:
   - 不要なCloud Functionsを削除
   - 古いStorageファイルを削除
   - レートリミットを強化

3. **サービスを一時停止**:
   - Cloud Functionsを無効化
   - Storageへの書き込みを制限

---

**最終更新**: 2025-01-XX
**確認方法**: `check_cost_settings.sh` を実行

