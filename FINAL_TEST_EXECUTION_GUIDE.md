# 🎯 最終テスト実施ガイド（完全版）

## ✅ 準備完了確認

### 実装確認
- [x] reply API: `event.replyToken`で到着直後に「解析中です」を返信
- [x] push API: `event.source.userId`でDifyのanswerをpush送信
- [x] エラーハンドリング: Dify API 500エラー時のフォールバック機能
- [x] フェイルセーフ: LINE Webhookの門前払い機能

### 検証ツール
- [x] `./verify_reply_push_detailed.sh` - 詳細検証（推奨）
- [x] `./verify_reply_push.sh` - 簡易検証
- [x] `./watch_logs.sh` - リアルタイムログ監視
- [x] `./test_logs.sh` - ログ確認

### ドキュメント
- [x] `REPLY_PUSH_VERIFICATION_FINAL.md` - reply→push検証手順
- [x] `COMMANDER_BATTLE_PLAN.md` - 作戦要綱
- [x] `FINAL_TEST_GUIDE.md` - 最終テストガイド

---

## 🚀 テスト実施手順

### ステップ1: テスト動画を準備
- **形式:** mp4
- **長さ:** 5-10秒
- **サイズ:** < 50MB

### ステップ2: LINEアプリで送信
1. LINEアプリを開く
2. **FLATUPGYM**とのトーク画面に移動
3. テスト動画を送信

### ステップ3: 証①を確認（即時）
**タイミング:** 動画送信後、数秒以内

**期待されるメッセージ:**
```
動画を受け付けました！AIが解析を開始します。

結果が届くまで、しばらくお待ちください…

※解析は20秒以内/100MB以下の動画が対象です。
```

**確認方法:** LINEアプリでメッセージを確認

---

### ステップ4: 証②を確認（ログ）
**タイミング:** 動画送信後、1-2分以内

**検証スクリプトを実行:**
```bash
./verify_reply_push_detailed.sh
```

**期待される出力:**
```
=== Webhook JSON確認（replyTokenとuserId抽出） ===
✅ replyToken: 82daef79ee744e1e933f1a44082fa43a
✅ userId: U521cd38b7f048be84eaa880ccabdc7f9

=== reply API確認（即座に返信） ===
✅ reply API成功: ユーザーへの受付完了メッセージの送信に成功しました。
   レスポンス: 2xx (成功)

=== push API確認（Dify結果送信） ===
✅ push API成功: レスポンス2xx (成功)

=== エラーログ確認 ===
✅ エラーなし

=== 検証結果サマリー ===
✅ 完全成功: reply APIとpush APIの両方が2xxで成功
✅ LINEにメッセージが届いていることを確認してください
```

**リアルタイム監視（オプション）:**
別のターミナルで以下を実行：
```bash
./watch_logs.sh
```

---

### ステップ5: 証③を確認（最終結果）
**タイミング:** 動画送信後、1-3分以内

**期待される結果:**

**正常ケース:**
- Difyからの解析結果（例: 「この動画では、キックボクシングのフォームが...」）

**Dify API 500エラーケース:**
- フォールバックメッセージ（例: 「動画の解析サマリー: Dify APIで一時的なエラーが発生しました。しばらく待ってから再度お試しください。後ほど完全版を送信します。」）

**確認方法:** LINEアプリでメッセージを確認

---

## ✅ 成功の基準

以下の3つすべてが確認できれば、**完全成功**です：

1. ✅ **証①: 受領メッセージ**
   - 動画送信後、数秒以内に「動画を受け付けました…」が届く
   - これはreply APIの成功を示す

2. ✅ **証②: ログ出力**
   - `replyToken`と`userId`が取得できる
   - reply APIの成功ログ（2xx）
   - push APIの成功ログ（2xx）

3. ✅ **証③: 最終結果**
   - 1-3分以内にLINEメッセージが届く
   - これはpush APIの成功を示す

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
gcloud logging read 'textPayload=~"sendLineMessage" OR textPayload=~"LINE push error"' \
  --limit=10 \
  --format="table(timestamp,severity,textPayload)" \
  --project=aikaapp-584fa \
  --freshness=10m
```

---

## 📊 エラー時の原因切り分け

### reply APIエラー

**よくあるエラー:**
- `400 Bad Request`: replyTokenが無効または期限切れ
- `401 Unauthorized`: チャネルアクセストークンが無効
- `429 Too Many Requests`: レート制限超過

**確認方法:**
```bash
gcloud logging read 'severity>=ERROR AND textPayload=~"reply\|replyMessage"' \
  --limit=5 \
  --format="json" \
  --project=aikaapp-584fa \
  --freshness=10m
```

### push APIエラー

**よくあるエラー:**
- `400 Bad Request`: userIdが無効、またはメッセージ形式が不正
- `401 Unauthorized`: チャネルアクセストークンが無効
- `429 Too Many Requests`: レート制限超過
- `500 Internal Server Error`: LINE API側のエラー

**確認方法:**
```bash
gcloud logging read 'severity>=ERROR AND textPayload=~"LINE push error\|sendLineMessage"' \
  --limit=5 \
  --format="json" \
  --project=aikaapp-584fa \
  --freshness=10m
```

---

## 🎉 システムの堅牢性

このシステムは、以下の堅牢性を実現しています：

1. **エラー耐性:** Dify APIが500エラーを返しても、システム全体が停止しない
2. **フェイルセーフ:** LINE Webhookが誤って`processVideoJob`に送信されても、正しく処理される
3. **ユーザー体験:** 何があっても、ユーザーに応答を返す
4. **商用レベルの堅牢性:** 単に動くだけでなく、「何があっても、ユーザーに応答を返す」という品質

---

## 📋 テスト結果記録

テスト実施後、以下を記録してください：

- **テスト日時:** 
- **動画形式:** mp4
- **動画サイズ:** MB
- **動画長さ:** 秒
- **証① (受領メッセージ):** ✅ / ❌
- **証② (ログ出力):** ✅ / ❌
- **証③ (最終結果):** ✅ / ❌
- **reply APIレスポンス:** 2xx / その他
- **push APIレスポンス:** 2xx / その他
- **結果メッセージ:** （届いたメッセージの内容）
- **備考:** 

---

**最終更新:** 2025-11-08  
**ステータス:** テスト実施準備完了 ✅

**次のステップ:** LINEアプリでFLATUPGYMにテスト動画を送信してください！

