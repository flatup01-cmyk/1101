# 🚀 Firebase Functions デプロイコマンド

## 📋 デプロイコマンド一覧

### すべてのFunctionsをデプロイ

```bash
cd "/Users/jin/Library/CloudStorage/Dropbox/NEW WORLD/1101 new"
firebase deploy --only functions
```

### 特定の関数のみデプロイ

```bash
cd "/Users/jin/Library/CloudStorage/Dropbox/NEW WORLD/1101 new"
firebase deploy --only functions:lineWebhookRouter,functions:processVideoJob
```

### lineWebhookRouterのみデプロイ

```bash
cd "/Users/jin/Library/CloudStorage/Dropbox/NEW WORLD/1101 new"
firebase deploy --only functions:lineWebhookRouter
```

### processVideoJobのみデプロイ

```bash
cd "/Users/jin/Library/CloudStorage/Dropbox/NEW WORLD/1101 new"
firebase deploy --only functions:processVideoJob
```

---

## 🎯 推奨デプロイコマンド

### reply APIの修正を反映する場合

```bash
cd "/Users/jin/Library/CloudStorage/Dropbox/NEW WORLD/1101 new"
firebase deploy --only functions:lineWebhookRouter
```

### 両方の関数を更新する場合

```bash
cd "/Users/jin/Library/CloudStorage/Dropbox/NEW WORLD/1101 new"
firebase deploy --only functions:lineWebhookRouter,functions:processVideoJob
```

---

## 📝 デプロイ前の確認

### 1. プロジェクトディレクトリに移動

```bash
cd "/Users/jin/Library/CloudStorage/Dropbox/NEW WORLD/1101 new"
```

### 2. Firebaseプロジェクトを確認

```bash
firebase use aikaapp-584fa
```

### 3. 構文チェック（オプション）

```bash
cd functions
node --check index.js
```

---

## ✅ デプロイ後の確認

### デプロイ成功の確認

```bash
# 関数の状態を確認
gcloud functions describe lineWebhookRouter --gen2 --region=asia-northeast1 --project=aikaapp-584fa --format="value(state,updateTime)"

gcloud functions describe processVideoJob --gen2 --region=asia-northeast1 --project=aikaapp-584fa --format="value(state,updateTime)"
```

### ログで動作確認

```bash
# 最新のログを確認
gcloud logging read 'resource.type="cloud_run_revision" AND (resource.labels.service_name="linewebhookrouter" OR resource.labels.service_name="processvideojob")' \
  --limit=10 \
  --format="table(timestamp,severity,resource.labels.service_name,textPayload)" \
  --project=aikaapp-584fa \
  --freshness=5m
```

---

**最終更新:** 2025-11-08  
**ステータス:** デプロイコマンド準備完了 ✅

