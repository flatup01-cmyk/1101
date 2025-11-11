# 🎯 最終テスト実施ガイド

## ✅ デプロイ完了

**デプロイ日時:** 2025-11-08 20:18  
**ステータス:** Deploy complete! ✅

## 📱 テスト実施手順

### ステップ1: LINEアプリを開く
スマートフォンでLINEアプリを開き、**FLATUPGYM**とのトーク画面に移動してください。

### ステップ2: テスト動画を送信
以下の条件を満たす動画を送信してください：
- **形式:** mp4
- **長さ:** 5-10秒
- **サイズ:** < 50MB

### ステップ3: 3つの勝利の証を確認

#### 証① (即時): 受領メッセージ
**期待されるメッセージ:**
```
動画を受け付けました！AIが解析を開始します。

結果が届くまで、しばらくお待ちください…

※解析は20秒以内/100MB以下の動画が対象です。
```

**確認タイミング:** 動画送信後、数秒以内

---

#### 証② (ログ): Cloud Logging確認
動画送信後、以下のコマンドでログを確認してください：

```bash
# processVideoJobのログを確認
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="processvideojob" AND (textPayload=~"processVideoJob開始" OR textPayload=~"processVideoJob成功" OR textPayload=~"LINE Webhookリクエスト")' \
  --limit=10 \
  --format="table(timestamp,severity,textPayload)" \
  --project=aikaapp-584fa \
  --freshness=10m

# 全体のログを確認（最新20件）
gcloud logging read 'resource.type="cloud_run_revision" AND (resource.labels.service_name="processvideojob" OR resource.labels.service_name="linewebhookrouter")' \
  --limit=20 \
  --format="table(timestamp,severity,resource.labels.service_name,textPayload)" \
  --project=aikaapp-584fa \
  --freshness=10m
```

**期待されるログ:**
- `processVideoJob開始: jobId=..., lineUserId=..., videoUrl=...`
- `processVideoJob成功: {"answer":"...","conversation_id":"..."}`

**確認タイミング:** 動画送信後、1-2分以内

---

#### 証③ (最終結果): LINEメッセージ
**期待される結果（正常ケース）:**
- Difyからの解析結果が届く
- 例: 「この動画では、キックボクシングのフォームが...」

**期待される結果（Dify API 500エラーケース）:**
- フォールバックメッセージが届く
- 例: 「動画の解析サマリー: Dify APIで一時的なエラーが発生しました。しばらく待ってから再度お試しください。後ほど完全版を送信します。」

**確認タイミング:** 動画送信後、1-3分以内

---

## 🔍 トラブルシューティング

### 証①が届かない場合
```bash
# lineWebhookRouterのログを確認
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="linewebhookrouter" AND textPayload=~"動画メッセージ"' \
  --limit=10 \
  --format="table(timestamp,severity,textPayload)" \
  --project=aikaapp-584fa \
  --freshness=10m
```

### 証②のログが出力されない場合
```bash
# エラーログを確認
gcloud logging read 'severity>=ERROR AND (resource.labels.service_name="processvideojob" OR resource.labels.service_name="linewebhookrouter")' \
  --limit=10 \
  --format="json" \
  --project=aikaapp-584fa \
  --freshness=10m
```

### 証③が届かない場合
```bash
# Dify APIのエラーログを確認
gcloud logging read 'textPayload=~"Dify API 500エラー" OR textPayload=~"Dify blocking error"' \
  --limit=10 \
  --format="table(timestamp,severity,textPayload)" \
  --project=aikaapp-584fa \
  --freshness=10m

# LINE送信のログを確認
gcloud logging read 'textPayload=~"sendLineMessage" OR textPayload=~"LINEメッセージ送信成功" OR textPayload=~"LINE push error"' \
  --limit=10 \
  --format="table(timestamp,severity,textPayload)" \
  --project=aikaapp-584fa \
  --freshness=10m
```

---

## 📊 テスト結果記録

テスト実施後、以下を記録してください：

- **テスト日時:** 
- **動画形式:** mp4
- **動画サイズ:** MB
- **動画長さ:** 秒
- **証① (受領メッセージ):** ✅ / ❌
- **証② (ログ出力):** ✅ / ❌
- **証③ (最終結果):** ✅ / ❌
- **結果メッセージ:** （届いたメッセージの内容）
- **備考:** 

---

## 🎉 成功の基準

以下の3つすべてが確認できれば、**完全成功**です：

1. ✅ 証①: 受領メッセージが届く
2. ✅ 証②: Cloud Loggingで`processVideoJob開始`と`processVideoJob成功`のログが出力される
3. ✅ 証③: LINEにDifyからの解析結果、またはフォールバックメッセージが届く

---

**最終更新:** 2025-11-08 20:18  
**ステータス:** テスト準備完了 ✅

**次のステップ:** LINEアプリでFLATUPGYMにテスト動画を送信してください！

