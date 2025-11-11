# 🎯 replyToken検証手順（デプロイ後）

## 📋 検証手順

### ステップ1: デプロイ

```bash
cd "/Users/jin/Library/CloudStorage/Dropbox/NEW WORLD/1101 new"
firebase deploy --only functions:lineWebhookRouter
```

### ステップ2: LINEボットに一言送信

LINEアプリで**FLATUPGYM**に任意のメッセージを送信してください。

### ステップ3: ログからreplyTokenを確認

```bash
# 最新のWebhook受信JSONを確認
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="linewebhookrouter" AND textPayload=~"Webhook受信JSON"' \
  --limit=1 \
  --format="value(textPayload)" \
  --project=aikaapp-584fa \
  --freshness=2m
```

**期待される出力:**
```
Webhook受信JSON: {"destination":"...","events":[{"type":"message","replyToken":"82daef79ee744e1e933f1a44082fa43a",...}]}
```

### ステップ4: replyTokenを抽出してreply APIを呼び出し

**方法1: 検証スクリプトを使用（推奨）**

```bash
./verify_reply_token.sh
```

このスクリプトは以下を自動で実行します：
1. 最新のWebhookログからreplyTokenを抽出
2. reply APIを呼び出し
3. 結果を表示

**方法2: 手動で検証**

```bash
# 1. replyTokenを取得（ログから手動でコピー）
REPLY_TOKEN="82daef79ee744e1e933f1a44082fa43a"  # ログから取得した値に置き換え

# 2. LINEチャネルアクセストークンを取得
TOKEN=$(gcloud secrets versions access latest --secret=LINE_CHANNEL_ACCESS_TOKEN --project=aikaapp-584fa)

# 3. reply APIを呼び出し
curl -X POST 'https://api.line.me/v2/bot/message/reply' \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d "{
    \"replyToken\": \"${REPLY_TOKEN}\",
    \"messages\": [
      {
        \"type\": \"text\",
        \"text\": \"replyToken検証: このメッセージが届けば成功です！\"
      }
    ]
  }"
```

### ステップ5: 結果を確認

**成功の場合:**
- HTTP 200が返る
- LINEアプリに「replyToken検証: このメッセージが届けば成功です！」が届く

**失敗の場合:**
- HTTP 400が返る（Invalid reply token）
- 原因を確認：
  - replyTokenが古い → 新しいメッセージを送信
  - 同じreplyTokenを2回使用 → 1回だけ使用
  - 全角引用符混入 → 半角の`"`を使用

---

## ✅ 検証チェックリスト

- [ ] デプロイ完了
- [ ] LINEボットにメッセージを送信
- [ ] ログから`events[0].replyToken`を確認
- [ ] reply APIを呼び出し
- [ ] HTTP 200が返る
- [ ] LINEアプリにメッセージが届く

---

## 🔍 トラブルシューティング

### replyTokenが取得できない場合

```bash
# ログを直接確認
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="linewebhookrouter"' \
  --limit=5 \
  --format="table(timestamp,severity,textPayload)" \
  --project=aikaapp-584fa \
  --freshness=5m
```

### HTTP 400エラーの場合

1. **最新のreplyTokenを使用しているか確認**
   - 新しいメッセージを送信して、最新のreplyTokenを取得

2. **全角引用符が混入していないか確認**
   - ダブルクォーテーションは半角の`"`を使用

3. **同じreplyTokenを2回以上使用していないか確認**
   - 1イベントにつき1回だけ使用

4. **改行や余計なスペースが含まれていないか確認**
   ```bash
   echo "$REPLY_TOKEN" | od -c
   ```

---

**最終更新:** 2025-11-08  
**ステータス:** 検証手順完成 ✅

