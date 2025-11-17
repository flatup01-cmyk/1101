# ✅ デプロイ完了・検証ガイド

## 🎉 デプロイ完了

- **リビジョン**: `process-video-trigger-00008-6hl`
- **サービスURL**: `https://process-video-trigger-639286700347.us-central1.run.app`
- **環境変数**: `DIFY_API_KEY`はSecret Managerから環境変数として設定済み
- **環境変数**: `DIFY_API_ENDPOINT=https://api.dify.ai/v1/chat-messages`

---

## 📋 実装された改善

### 1. **DIFY_API_KEYの読み込み方法を変更**
   - **変更前**: Secret Managerから直接読み込み
   - **変更後**: 環境変数から読み込み（Cloud RunではSecret Managerから環境変数として設定される）
   - **フォールバック**: 環境変数が設定されていない場合のみ、Secret Managerから直接読み込み

### 2. **ASCIIサニタイズ関数を追加**
   - `sanitize_api_key()`関数でAPIキーをASCIIのみにサニタイズ
   - 改行・全角・不可視文字を除去

### 3. **requests.postをjson=payloadに変更**
   - urllib3の複雑な処理を削除
   - `requests.post`を`json=payload`で使用（latin-1対策）

### 4. **ヘッダーをASCIIのみに簡素化**
   - `Content-Type`から`charset=utf-8`を削除
   - `User-Agent`を`aika/1.0`に短縮

### 5. **パス検証の許容範囲を拡大**
   - 新しいパターン（`videos/{userId}/{messageId}.mp4`）を許可
   - 既存のパターンも継続して許可

---

## 🔍 検証方法

### ステップ1: 新しいリビジョンで動画をアップロード

1. **LINEアプリから動画をアップロード**
2. **LIFFアプリから動画をアップロード**

### ステップ2: ログを確認

```bash
# 最新のログを確認（新しいリビジョン）
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=process-video-trigger AND resource.labels.revision_name=process-video-trigger-00008-6hl" --limit=50 --format=json --project=aikaapp-584fa
```

### ステップ3: 確認すべきログ項目

#### ✅ 成功時のログ

- `✅ DIFY_API_KEYを環境変数から読み込みました（Cloud Run Secret Manager経由）`
- `📋 Dify API設定確認:`
- `✅ Dify API呼び出し成功:`
- `✅ LINEメッセージ送信成功:`

#### ❌ エラー時のログ

- `❌ Dify API 401認証エラー`が表示されないこと
- `ERR_INVALID_CHAR`エラーが表示されないこと
- `latin-1`エラーが表示されないこと

---

## ⚠️ 401エラーが発生する場合

### 原因1: Secret ManagerのAPIキーが無効

**確認方法**:
```bash
# Secret ManagerのAPIキーを確認（マスクされて表示される）
gcloud secrets versions access latest --secret="DIFY_API_KEY" --project=aikaapp-584fa
```

**解決方法**:
1. Dify StudioでAPIキーが有効か確認
2. 無効な場合は、新しいAPIキーを発行
3. Secret ManagerのAPIキーを更新

```bash
# Secret ManagerのAPIキーを更新
echo -n "あなたの有効なDify APIキー" | \
  gcloud secrets versions add DIFY_API_KEY \
  --data-file=- \
  --project=aikaapp-584fa
```

### 原因2: 環境変数が正しく設定されていない

**確認方法**:
```bash
# Cloud Runサービスの環境変数を確認
gcloud run services describe process-video-trigger \
  --region=us-central1 \
  --format="value(spec.template.spec.containers[0].env)" \
  --project=aikaapp-584fa
```

**解決方法**:
1. Cloud Runサービスの環境変数を確認
2. `DIFY_API_KEY`がSecret Managerから設定されているか確認
3. 設定されていない場合は、再デプロイ

```bash
# 再デプロイ
gcloud run deploy process-video-trigger \
  --source=./functions \
  --region=us-central1 \
  --platform=managed \
  --update-secrets DIFY_API_KEY=DIFY_API_KEY:latest \
  --set-env-vars DIFY_API_ENDPOINT=https://api.dify.ai/v1/chat-messages \
  --project=aikaapp-584fa
```

---

## 📊 期待される動作

### 正常な動作フロー

1. **動画アップロード**
   - LINEアプリまたはLIFFアプリから動画をアップロード

2. **Cloud Storageに保存**
   - 動画がCloud Storageに保存される
   - Cloud Runが自動的にトリガーされる

3. **動画解析**
   - 動画が解析される
   - スコアが計算される

4. **Dify API呼び出し**
   - スコアをDify APIに送信
   - AIKAのセリフが生成される

5. **LINEメッセージ送信**
   - ユーザーにLINEメッセージが送信される

6. **Firestoreに保存**
   - 分析結果がFirestoreに保存される

---

## 🚀 次のステップ

1. **動画をアップロードしてテスト**
2. **ログを確認して、401エラーが解消されたか確認**
3. **新しいリビジョンで正常に動作するか確認**

---

**最終更新**: 2025-11-15  
**状態**: ✅ デプロイ完了  
**リビジョン**: `process-video-trigger-00008-6hl`

