# 🎯 replyToken検証手順（最終版）

## 📋 検証手順

### ステップ1: LINEボットに新しいメッセージを送信

LINEアプリで**FLATUPGYM**に新しいメッセージを送信してください。

### ステップ2: 送信直後（数秒以内）にスクリプトを実行

```bash
./reply_now.sh
```

### ステップ3: 結果を確認

**成功の場合:**
- HTTP 200が返る
- LINEアプリに「replyToken検証: このメッセージが届けば成功です！」が届く

**失敗の場合（HTTP 400）:**
- もう一度「新しいメッセージ → 直ちにスクリプト」を繰り返す

---

## ✅ スクリプトの改善点

### アクセストークンの取得方法

```bash
# Secretから取得し、改行をstrip
TOKEN=$(gcloud secrets versions access latest --secret=LINE_CHANNEL_ACCESS_TOKEN --project=aikaapp-584fa 2>/dev/null | tr -d '\n\r ')
```

**改善内容:**
- `tr -d '\n\r '`で改行、キャリッジリターン、スペースを削除
- これにより、アクセストークンに余計な文字が含まれない

### プロジェクトIDとサービス名

スクリプト内で以下が設定されています：
- **プロジェクトID:** `aikaapp-584fa`
- **サービス名:** `linewebhookrouter`

環境に合わせて変更してください。

---

## 🔍 トラブルシューティング

### HTTP 400エラーの場合

1. **新しいメッセージを送信**
   - LINEボットに新しいメッセージを送信

2. **すぐにスクリプトを実行**
   - メッセージ送信後、数秒以内に`./reply_now.sh`を実行

3. **繰り返す**
   - HTTP 400が返った場合は、もう一度「新しいメッセージ → 直ちにスクリプト」を繰り返す

### replyTokenが取得できない場合

```bash
# ログを直接確認
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="linewebhookrouter" AND textPayload=~"Webhook受信JSON"' \
  --limit=5 \
  --format="table(timestamp,textPayload)" \
  --project=aikaapp-584fa \
  --freshness=5m
```

---

## 📊 検証チェックリスト

- [ ] LINEボットに新しいメッセージを送信
- [ ] 送信直後（数秒以内）に`./reply_now.sh`を実行
- [ ] HTTP 200が返る
- [ ] LINEアプリにメッセージが届く

---

**最終更新:** 2025-11-08  
**ステータス:** 検証手順完成 ✅

