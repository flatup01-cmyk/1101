# 🔒 セキュリティチェックリスト - 最終確認

## ✅ 実装済みセキュリティ対策

### 1. API連打攻撃対策

#### ✅ レートリミット機能
- **実装場所**: `functions/rate_limiter.py`
- **設定**: 1時間あたり5回まで
- **動作**: Firestoreでリクエスト履歴を管理し、超過時は自動拒否

#### ✅ LINE Webhookのレートリミット
- LINE公式アカウントのレートリミット設定を確認
- 異常なリクエストを検知

### 2. APIキーの保護

#### ✅ Secret Manager使用
- **LINE_CHANNEL_ACCESS_TOKEN**: Secret Managerで管理（`functions/main.py`）
- **DIFY_API_KEY**: Firebase Functions Secretsで管理（`functions/index.js`）

#### ⚠️ 確認事項
- [ ] Secret ManagerにAPIキーが正しく保存されているか
- [ ] 環境変数にAPIキーが直接書かれていないか
- [ ] コードにAPIキーがハードコードされていないか

### 3. Webhook署名検証（推奨）

#### ⚠️ 未実装（要追加）

LINE Webhookの署名検証を追加することを推奨：

```javascript
// functions/index.js に追加
import crypto from 'crypto';

function verifyLineSignature(body, signature, channelSecret) {
  const hash = crypto
    .createHmac('sha256', channelSecret)
    .update(body)
    .digest('base64');
  return hash === signature;
}

// lineWebhookRouter内で使用
const signature = req.headers['x-line-signature'];
if (!verifyLineSignature(JSON.stringify(req.body), signature, process.env.LINE_CHANNEL_SECRET)) {
  res.status(401).send('Unauthorized');
  return;
}
```

### 4. エラーハンドリング

#### ✅ 実装済み
- 全てのエラーケースでメッセージが返る
- 20秒超過時の適切なメッセージ
- 容量超過時の適切なメッセージ
- 予期しないエラー時のフォールバックメッセージ

### 5. コスト管理

#### ✅ 実装済み
- Storage自動削除機能（2.5GB制限）
- レートリミットによる過剰実行防止
- GCP予算アラート設定（要確認）

---

## 🔍 セキュリティチェック項目

### APIキーの確認

```bash
# Secret Managerの確認
gcloud secrets list --project=aikaapp-584fa

# 環境変数の確認（APIキーが直接書かれていないか）
gcloud functions describe lineWebhookRouter \
  --region=asia-northeast1 \
  --project=aikaapp-584fa \
  --gen2 \
  --format="value(serviceConfig.environmentVariables)"
```

### レートリミットの確認

```bash
# Firestoreのレートリミットデータを確認
# Firebase Console → Firestore → rate_limits コレクション
```

### Webhook署名検証の追加（推奨）

`functions/index.js`に以下を追加：

```javascript
import crypto from 'crypto';

// LINE Webhook署名検証関数
function verifyLineSignature(body, signature, channelSecret) {
  if (!signature || !channelSecret) {
    return false;
  }
  const hash = crypto
    .createHmac('sha256', channelSecret)
    .update(body)
    .digest('base64');
  return hash === signature;
}

// lineWebhookRouter内で使用
export const lineWebhookRouter = onRequest(
  {
    secrets: ["MAKE_WEBHOOK_URL", "LINE_CHANNEL_ACCESS_TOKEN", "PROCESS_VIDEO_JOB_URL", "DIFY_API_KEY", "LINE_CHANNEL_SECRET"],
    // ...
  },
  async (req, res) => {
    // 署名検証
    const signature = req.headers['x-line-signature'];
    const rawBody = JSON.stringify(req.body);
    const channelSecret = process.env.LINE_CHANNEL_SECRET;
    
    if (!verifyLineSignature(rawBody, signature, channelSecret)) {
      console.error("LINE Webhook署名検証失敗");
      res.status(401).send('Unauthorized');
      return;
    }
    
    // 既存の処理...
  }
);
```

---

## 🚨 緊急時の対応

### APIキーが流出した場合

1. **即座に無効化**
   - LINE Developers Consoleでチャネルアクセストークンを再発行
   - Dify ConsoleでAPIキーを再発行
   - Secret Managerのシークレットを更新

2. **影響範囲の確認**
   - Cloud Functionsのログを確認
   - 異常なアクセスがないか確認

3. **再デプロイ**
   - 新しいAPIキーで再デプロイ

### 異常なAPI呼び出しが発生した場合

1. **レートリミットを強化**
   ```python
   # functions/rate_limiter.py
   RATE_LIMIT_MAX_REQUESTS = 3  # 5回から3回に変更
   ```

2. **Cloud Functionsを一時停止**
   ```bash
   gcloud functions update lineWebhookRouter \
     --region=asia-northeast1 \
     --no-allow-unauthenticated \
     --project=aikaapp-584fa
   ```

3. **ログを確認**
   ```bash
   gcloud functions logs read lineWebhookRouter \
     --region=asia-northeast1 \
     --project=aikaapp-584fa \
     --limit=100
   ```

---

## ✅ 最終チェックリスト

### セキュリティ
- [ ] APIキーがSecret Managerで管理されている
- [ ] コードにAPIキーがハードコードされていない
- [ ] レートリミットが正しく動作している
- [ ] Webhook署名検証が実装されている（推奨）
- [ ] エラーハンドリングが全てのケースで動作している

### コスト管理
- [ ] Storage自動削除機能が設定されている
- [ ] GCP予算アラートが設定されている
- [ ] レートリミットで過剰実行を防止している

### 動作確認
- [ ] 動画が20秒超過時に適切なメッセージが返る
- [ ] 動画が100MB超過時に適切なメッセージが返る
- [ ] テキストメッセージでDify APIが正しく動作する
- [ ] エラー時も必ずメッセージが返る

---

**最終更新**: 2025-01-XX
**確認者**: [あなたの名前]

