# 🔄 replyToken正しい使用方法ガイド

## 📋 基本原則

**replyTokenはWebhook受信JSONから取り出し、受信直後にそのまま使います。**

## ❌ よくある失敗と修正ポイント

### 1. 最新のreplyTokenではない
**症状:** `400 Bad Request: Invalid reply token`

**原因:** 古いWebhookイベントのreplyTokenを使用している

**修正方法:**
- 新規にメッセージを送り直して再取得
- 最新のWebhookイベントから`events[0].replyToken`を取得

### 2. 引用符が全角になっている
**症状:** `400 Bad Request` または構文エラー

**原因:** ダブルクォーテーションが全角（"）になっている

**修正方法:**
- ダブルクォーテーションは半角の`"`を使用
- コードエディタで全角文字を検索・置換

### 3. 余計な改行/スペース混入
**症状:** `400 Bad Request` または予期しない動作

**原因:** replyTokenに改行や余計なスペースが含まれている

**確認方法:**
```bash
echo "$LINE_REPLY_TOKEN" | od -c
```

**修正方法:**
- 改行が出たら削除
- `.trim()`を使用して前後の空白を削除

### 4. 同じreplyTokenを二重送信
**症状:** 2回目は必ず`400 Bad Request`

**原因:** 同じreplyTokenを2回以上使用している

**修正方法:**
- 1イベントにつき1回だけ送信
- replyTokenは1回しか使用できない

---

## ✅ 正しい実装例

### Firebase Functions (Node.js)

```javascript
export const lineWebhookRouter = onRequest(
  async (req, res) => {
    res.status(200).send('OK');
    
    // Webhook受信JSONをログ出力（replyToken確認用）
    console.info("Webhook受信JSON:", JSON.stringify(req.body));
    
    const events = req.body?.events;
    if (!events || events.length === 0) {
      return;
    }
    
    const event = events[0];
    const replyToken = event?.replyToken;  // 受信直後に取り出す
    const userId = event?.source?.userId;
    
    console.info('replyToken:', replyToken);
    console.info('userId:', userId);
    
    // すぐ返信（replyTokenがある場合のみ、受信直後に使用）
    if (replyToken) {
      await fetch('https://api.line.me/v2/bot/message/reply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
        },
        body: JSON.stringify({
          replyToken,  // そのまま使用（全角引用符なし）
          messages: [{ type: 'text', text: '解析中です。少しお待ちください。' }]
        })
      });
      console.info("ユーザーへの受付完了メッセージの送信に成功しました。");
    }
  }
);
```

---

## 🔍 デバッグ方法

### 1. Webhook受信JSONをログ出力

**Node.js:**
```javascript
console.log(JSON.stringify(req.body));
```

**Python:**
```python
print(json.dumps(data))
```

### 2. replyTokenを確認

ログに出た`events[0].replyToken`をそのまま使えば通ります。

### 3. replyTokenの検証

```bash
# replyTokenに改行や余計な文字が含まれていないか確認
echo "$LINE_REPLY_TOKEN" | od -c

# 期待される出力: 英数字とハイフンのみ（改行なし）
```

---

## 📊 チェックリスト

- [ ] 最新のWebhookイベントからreplyTokenを取得している
- [ ] 受信直後にreplyTokenを使用している
- [ ] 全角引用符を使用していない（半角の`"`を使用）
- [ ] replyTokenに改行や余計なスペースが含まれていない
- [ ] 同じreplyTokenを2回以上使用していない
- [ ] Webhook受信JSONをログ出力している

---

## 🚀 確実に成功させる最短手順

1. **新しいメッセージを送信**
   - LINEアプリで新しいメッセージを送信
   - これにより最新のWebhookイベントが生成される

2. **Webhook受信JSONを確認**
   ```bash
   gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="linewebhookrouter" AND textPayload=~"Webhook受信JSON"' \
     --limit=1 \
     --format="value(textPayload)" \
     --project=aikaapp-584fa \
     --freshness=5m
   ```

3. **replyTokenを抽出**
   - ログから`events[0].replyToken`を取得
   - そのまま使用（コピー&ペースト）

4. **reply APIを呼び出し**
   - 受信直後にreply APIを呼び出す
   - 全角引用符を使用しない
   - 改行や余計なスペースを含めない

---

**最終更新:** 2025-11-08  
**ステータス:** replyToken使用方法ガイド完成 ✅

