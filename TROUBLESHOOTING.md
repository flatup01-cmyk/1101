# 🔧 AIKA18号 トラブルシューティングガイド

## 🚨 よくあるエラーと解決策

---

## エラー1: Secret Manager読み込み失敗

### 症状

```
⚠️ Secret Managerからの読み込み失敗。環境変数にフォールバック
❌ CRITICAL: LINE_CHANNEL_ACCESS_TOKENが設定されていません！
```

### 原因

- Secret Managerのシークレット名が間違っている
- Cloud Functionsのサービスアカウントに権限がない
- シークレットが作成されていない

### 解決策

#### 1. シークレットの存在確認

```bash
gcloud secrets list --project=aikaapp-584fa
```

#### 2. シークレット名の確認

`functions/main.py`で使用しているシークレット名を確認：

```python
LINE_CHANNEL_ACCESS_TOKEN = access_secret_version("line-channel-access-token", PROJECT_ID)
```

**正しいシークレット名**: `line-channel-access-token`

#### 3. サービスアカウントに権限付与

```bash
gcloud projects add-iam-policy-binding aikaapp-584fa \
  --member="serviceAccount:aikaapp-584fa@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

#### 4. シークレットが存在しない場合

```bash
# シークレット作成
echo -n "YOUR_LINE_ACCESS_TOKEN" | gcloud secrets create line-channel-access-token \
  --data-file=- \
  --project=aikaapp-584fa

# バージョン追加
echo -n "YOUR_LINE_ACCESS_TOKEN" | gcloud secrets versions add line-channel-access-token \
  --data-file=- \
  --project=aikaapp-584fa
```

---

## エラー2: Cloud Functionsがトリガーされない

### 症状

- Storageに動画をアップロードしてもFunctionが起動しない
- Cloud Functionsのログに何も記録されない

### 原因

- Storageイベントトリガーの設定がない
- Cloud Functionsがデプロイされていない
- パスが`videos/`で始まっていない

### 解決策

#### 1. Cloud Functionsのデプロイ確認

```bash
# デプロイ済みのFunctionsを確認
gcloud functions list --project=aikaapp-584fa

# または
firebase functions:list
```

#### 2. Storageイベントトリガーの設定確認

`functions/main.py`でCloudEvent形式の関数を確認：

```python
@functions_framework.cloud_event
def process_video_trigger(cloud_event):
    # ...
```

#### 3. Firebase CLIでデプロイ

```bash
firebase deploy --only functions:process_video_trigger
```

#### 4. パスの確認

Storageへのアップロードパスが`videos/{userId}/{jobId}/{fileName}`形式であることを確認。

---

## エラー3: LINE API送信失敗

### 症状

```
❌ CRITICAL: LINE通知失敗（3回リトライ後）
WARNING: LINE API呼び出しエラー: 401 Unauthorized
```

### 原因

- LINE Channel Access Tokenが無効
- トークンの有効期限切れ
- トークンの値が間違っている

### 解決策

#### 1. Secret Managerのトークン確認

```bash
gcloud secrets versions access latest \
  --secret="line-channel-access-token" \
  --project=aikaapp-584fa
```

**注意**: トークンが正しい形式（`dmEAWqya...`のような長い文字列）であることを確認。

#### 2. LINE Developers Consoleで確認

1. [LINE Developers Consoleにアクセス](https://developers.line.biz/)
2. チャネル設定を確認
3. Channel Access Tokenを再発行（必要に応じて）
4. Secret Managerに新しいトークンを保存

#### 3. トークンの更新

```bash
# 新しいトークンをSecret Managerに保存
echo -n "NEW_LINE_ACCESS_TOKEN" | gcloud secrets versions add line-channel-access-token \
  --data-file=- \
  --project=aikaapp-584fa
```

---

## エラー4: 動画解析エラー

### 症状

```
ERROR: Analysis failed: ...
CRITICAL: 動画処理エラー
```

### 原因

- 動画ファイルが破損
- OpenCV/MediaPipeが動画を読み込めない
- メモリ不足

### 解決策

#### 1. 動画ファイルの確認

- 動画が正しい形式（.mp4, .mov, .avi等）であることを確認
- 動画が破損していないことを確認
- サイズが100MB以内であることを確認

#### 2. Cloud Functionsのメモリ制限確認

`functions/main.py`のデプロイ設定でメモリ制限を確認：

```yaml
# firebase.json またはデプロイ時の設定
{
  "functions": {
    "memory": "2GB"  # 必要に応じて増やす
  }
}
```

#### 3. 一時ファイルのクリーンアップ確認

`finally`ブロックで一時ファイルが削除されていることを確認。

---

## エラー5: Firestoreトランザクション失敗

### 症状

```
ERROR: Firestore transaction failed
ERROR: トランザクション失敗
```

### 原因

- Firestoreへの接続エラー
- トランザクションの競合
- 権限不足

### 解決策

#### 1. Firestoreの権限確認

Cloud FunctionsのサービスアカウントにFirestoreへの書き込み権限があることを確認。

#### 2. トランザクションのリトライ

`functions/main.py`のトランザクション部分を確認：

```python
transaction = db.transaction()
is_new = transaction.run(check_and_mark_processing)
```

#### 3. ログの詳細確認

```bash
gcloud logging read "severity>=ERROR" \
  --project=aikaapp-584fa \
  --limit=50
```

---

## エラー6: Dify API呼び出し失敗

### 症状

```
⚠️ Dify APIからメッセージが取得できませんでした
Dify APIエラー: 401 Unauthorized
```

### 原因

- Dify APIのエンドポイントが間違っている
- APIキーが無効
- 環境変数が設定されていない

### 解決策

#### 1. 環境変数の確認

```bash
firebase functions:config:get
```

#### 2. Dify API設定の確認

`functions/main.py`で使用している変数名を確認：

```python
DIFY_API_ENDPOINT = os.environ.get('DIFY_API_ENDPOINT', '')
DIFY_API_KEY = os.environ.get('DIFY_API_KEY', '')
```

#### 3. 環境変数の設定

```bash
firebase functions:config:set \
  dify.api_endpoint="https://api.dify.ai/v1/workflows/run" \
  dify.api_key="your-dify-api-key"
```

**注意**: Dify APIが設定されていない場合、デフォルトメッセージが使用されます。

---

## エラー7: レートリミットエラー

### 症状

```
❌ レートリミット超過: 1日のアップロード上限（10回）に達しました
```

### 原因

- ユーザーが1日に10回以上アップロード
- 短時間で3回以上アップロード

### 解決策

**これは正常な動作です**。レートリミットを緩和する場合は`functions/rate_limiter.py`を編集：

```python
RATE_LIMIT_CONFIG = {
    'upload_video': {
        'max_requests': 20,  # 10から20に増やす
        'window_seconds': 86400,
        'short_window_requests': 5,  # 3から5に増やす
        'short_window_seconds': 3600,
    }
}
```

---

## エラー8: UIが表示されない

### 症状

- ブラウザで真っ白な画面
- コンソールにJavaScriptエラー

### 原因

- `main.js`のインポートエラー
- LIFF設定の問題
- Firebase設定の問題

### 解決策

#### 1. ブラウザコンソールの確認

開発者ツール（F12）でエラーメッセージを確認。

#### 2. ネットワークタブの確認

- `main.js`が読み込まれているか
- `ui-revolution.css`が読み込まれているか
- Firebase関連のリクエストが成功しているか

#### 3. LIFF設定の確認

`src/config.js`でLIFF設定を確認：

```javascript
export const LIFF_CONFIG = {
  liffId: 'YOUR_LIFF_ID',
  // ...
};
```

---

## 📊 ログの確認方法

### Cloud Functionsログ

```bash
# リアルタイムログ
firebase functions:log

# エラーログのみ
gcloud logging read "severity>=ERROR" \
  --project=aikaapp-584fa \
  --limit=50

# 特定の関数のログ
gcloud functions logs read process_video_trigger \
  --project=aikaapp-584fa \
  --limit=50
```

### Firestoreデータの確認

Firebaseコンソールで`video_jobs`コレクションを確認：
- `status`フィールドの値
- `error_message`フィールド（エラー時）
- `notification_sent`フィールド

---

## 🆘 それでも解決しない場合

1. **Cloud Loggingで詳細ログを確認**
   ```bash
   gcloud logging read "severity>=WARNING" \
     --project=aikaapp-584fa \
     --limit=100 \
     --format=json > logs.json
   ```

2. **Firebaseサポートに問い合わせ**
   - [Firebase Support](https://firebase.google.com/support)

3. **GitHub Issueを作成**
   - エラーログと再現手順を添付

---

**最終更新**: 2025-01-XX  
**作成者**: AI Assistant (Auto)

