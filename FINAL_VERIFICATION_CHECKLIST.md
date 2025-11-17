# ✅ 最終検証チェックリスト

## 🎉 デプロイ完了

- **リビジョン**: `process-video-trigger-00008-6hl`
- **サービスURL**: `https://process-video-trigger-639286700347.us-central1.run.app`
- **デプロイ時刻**: 2025-11-15 03:37:xx

---

## 📋 実装完了した改善

### ✅ 1. DIFY_API_KEYの読み込み方法を修正
   - **変更前**: Secret Managerから直接読み込み
   - **変更後**: 環境変数から読み込み（Cloud RunではSecret Managerから環境変数として設定される）
   - **フォールバック**: 環境変数が設定されていない場合のみ、Secret Managerから直接読み込み

### ✅ 2. ASCIIサニタイズ関数を追加
   - `sanitize_api_key()`関数でAPIキーをASCIIのみにサニタイズ
   - 改行・全角・不可視文字を除去

### ✅ 3. requests.postをjson=payloadに変更
   - urllib3の複雑な処理を削除
   - `requests.post`を`json=payload`で使用（latin-1対策）

### ✅ 4. ヘッダーをASCIIのみに簡素化
   - `Content-Type`から`charset=utf-8`を削除
   - `User-Agent`を`aika/1.0`に短縮

### ✅ 5. パス検証の許容範囲を拡大
   - 新しいパターン（`videos/{userId}/{messageId}.mp4`）を許可
   - 既存のパターンも継続して許可

---

## 🔍 検証手順

### ステップ1: 新しいリビジョンで動画をアップロード

1. **LINEアプリから動画をアップロード**
   - LINEアプリを開く
   - 動画を選択（20秒以内、100MB以下）
   - 送信

2. **LIFFアプリから動画をアップロード**
   - LIFFアプリを開く
   - 動画を選択（20秒以内、100MB以下）
   - アップロード

### ステップ2: ログを確認

```bash
# 最新のログを確認（新しいリビジョン）
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=process-video-trigger AND resource.labels.revision_name=process-video-trigger-00008-6hl" --limit=50 --format=json --project=aikaapp-584fa
```

### ステップ3: 確認すべきログ項目

#### ✅ 成功時のログ（期待される出力）

1. **環境変数の読み込み**
   ```
   ✅ DIFY_API_KEYを環境変数から読み込みました（Cloud Run Secret Manager経由）
   ```

2. **Dify API設定確認**
   ```
   📋 Dify API設定確認:
      - ENDPOINT: https://api.dify.ai/v1/chat-messages
      - API_KEY: app-6OBnN... (長さ: XX)
   ```

3. **Dify API呼び出し成功**
   ```
   ✅ Dify API呼び出し成功: [AIKAのセリフの先頭50文字]...
   ```

4. **LINEメッセージ送信成功**
   ```
   ✅ LINEメッセージ送信成功: U521cd38b7f048be84eaa880ccabdc7f9
   ```

5. **処理完了**
   ```
   ✅ 処理完了: {"status": "success", "analysis": {...}}
   ```

#### ❌ エラー時のログ（発生しないことを確認）

1. **401認証エラー**
   ```
   ❌ Dify API 401認証エラー: Access tokenが無効です。
   ```
   → **これが表示されないことを確認**

2. **ERR_INVALID_CHARエラー**
   ```
   ERR_INVALID_CHAR
   ```
   → **これが表示されないことを確認**

3. **latin-1エラー**
   ```
   latin-1
   ```
   → **これが表示されないことを確認**

---

## 🔍 トラブルシューティング

### 問題1: 401エラーが依然として発生する

**原因**: Secret ManagerのAPIキーが無効または古い

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

4. Cloud Runサービスを再起動（新しいリビジョンをデプロイ）

```bash
# 再デプロイ（環境変数は自動的に更新される）
gcloud run deploy process-video-trigger \
  --source=./functions \
  --region=us-central1 \
  --platform=managed \
  --update-secrets DIFY_API_KEY=DIFY_API_KEY:latest \
  --set-env-vars DIFY_API_ENDPOINT=https://api.dify.ai/v1/chat-messages \
  --project=aikaapp-584fa
```

### 問題2: 環境変数が設定されていない

**確認方法**:
```bash
# Cloud Runサービスの環境変数を確認
gcloud run services describe process-video-trigger \
  --region=us-central1 \
  --format="value(spec.template.spec.containers[0].env)" \
  --project=aikaapp-584fa
```

**期待される出力**:
```
{'name': 'DIFY_API_KEY', 'valueFrom': {'secretKeyRef': {'key': 'latest', 'name': 'DIFY_API_KEY'}}};{'name': 'DIFY_API_ENDPOINT', 'value': 'https://api.dify.ai/v1/chat-messages'}
```

### 問題3: Secret Managerへのアクセス権限がない

**確認方法**:
```bash
# Secret ManagerのIAMポリシーを確認
gcloud secrets get-iam-policy DIFY_API_KEY --project=aikaapp-584fa
```

**期待される出力**:
```
bindings:
- members:
  - serviceAccount:639286700347-compute@developer.gserviceaccount.com
  role: roles/secretmanager.secretAccessor
```

---

## 📊 期待される動作フロー

### 正常な動作フロー

1. **動画アップロード**
   - LINEアプリまたはLIFFアプリから動画をアップロード
   - Cloud Storageに保存される

2. **Cloud Runがトリガーされる**
   - Cloud Storageに動画が保存されると、Cloud Runが自動的にトリガーされる
   - 新しいリビジョン（`process-video-trigger-00008-6hl`）が実行される

3. **環境変数の読み込み**
   - `DIFY_API_KEY`が環境変数から読み込まれる（Secret Manager経由）
   - ログに`✅ DIFY_API_KEYを環境変数から読み込みました（Cloud Run Secret Manager経由）`が表示される

4. **動画解析**
   - 動画が解析される
   - スコアが計算される

5. **Dify API呼び出し**
   - スコアをDify APIに送信
   - APIキーがASCIIサニタイズされる
   - `requests.post`を`json=payload`で使用
   - ヘッダーはASCIIのみ
   - **401エラーが発生しない**

6. **AIKAのセリフ生成**
   - Dify APIからAIKAのセリフが返される
   - ログに`✅ Dify API呼び出し成功:`が表示される

7. **LINEメッセージ送信**
   - ユーザーにLINEメッセージが送信される
   - ログに`✅ LINEメッセージ送信成功:`が表示される

8. **Firestoreに保存**
   - 分析結果がFirestoreに保存される
   - ログに`✅ 処理完了:`が表示される

---

## 🚀 次のステップ

1. **動画をアップロードしてテスト**
   - LINEアプリまたはLIFFアプリから動画をアップロード
   - 新しいリビジョンで処理が実行されることを確認

2. **ログを確認**
   - 新しいリビジョンのログを確認
   - 401エラーが発生しないことを確認
   - 正常に処理が完了することを確認

3. **動作確認**
   - LINEメッセージが正しく送信されることを確認
   - AIKAのセリフが正しく生成されることを確認

---

## 📝 検証コマンド

### ログを確認

```bash
# 最新のログを確認
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=process-video-trigger AND resource.labels.revision_name=process-video-trigger-00008-6hl" --limit=50 --format=json --project=aikaapp-584fa
```

### 環境変数を確認

```bash
# Cloud Runサービスの環境変数を確認
gcloud run services describe process-video-trigger \
  --region=us-central1 \
  --format="value(spec.template.spec.containers[0].env)" \
  --project=aikaapp-584fa
```

### Secret Managerを確認

```bash
# Secret ManagerのAPIキーを確認（マスクされて表示される）
gcloud secrets versions access latest --secret="DIFY_API_KEY" --project=aikaapp-584fa
```

---

**最終更新**: 2025-11-15  
**状態**: ✅ デプロイ完了  
**リビジョン**: `process-video-trigger-00008-6hl`  
**次のステップ**: 動画をアップロードしてテスト

