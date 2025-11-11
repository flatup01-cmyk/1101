# 🎯 最終テスト - 指揮官の作戦要綱

## 📋 作戦概要

**目標:** システムの堅牢性を最終確認し、3つの勝利の証を確認する

**準備完了:** ✅
- デプロイ完了
- ログ確認スクリプト作成済み
- リアルタイム監視スクリプト作成済み

---

## 🎯 3つの勝利の証

### 証① (即時): 受領メッセージ
**タイミング:** 動画送信後、数秒以内  
**期待されるメッセージ:**
```
動画を受け付けました！AIが解析を開始します。

結果が届くまで、しばらくお待ちください…

※解析は20秒以内/100MB以下の動画が対象です。
```

### 証② (ログ): processVideoJobの実行確認
**タイミング:** 動画送信後、1-2分以内  
**確認方法:**
```bash
./test_logs.sh
```

**期待されるログ:**
- `processVideoJob開始: jobId=..., lineUserId=..., videoUrl=...`
- `processVideoJob成功: {"answer":"...","conversation_id":"..."}`

### 証③ (最終結果): LINEメッセージ
**タイミング:** 動画送信後、1-3分以内  
**期待される結果:**

**正常ケース:**
- Difyからの解析結果（例: 「この動画では、キックボクシングのフォームが...」）

**Dify API 500エラーケース:**
- フォールバックメッセージ（例: 「動画の解析サマリー: Dify APIで一時的なエラーが発生しました。しばらく待ってから再度お試しください。後ほど完全版を送信します。」）

---

## 🚀 テスト実施手順

### ステップ1: LINEアプリを開く
スマートフォンでLINEアプリを開き、**FLATUPGYM**とのトーク画面に移動

### ステップ2: テスト動画を送信
- **形式:** mp4
- **長さ:** 5-10秒
- **サイズ:** < 50MB

### ステップ3: 証①を確認
動画送信後、数秒以内に受領メッセージが届くことを確認

### ステップ4: 証②を確認（ログ監視）
別のターミナルで以下を実行：

**リアルタイム監視（推奨）:**
```bash
./watch_logs.sh
```

**または、一度だけ確認:**
```bash
./test_logs.sh
```

### ステップ5: 証③を確認
動画送信後、1-3分以内にLINEメッセージが届くことを確認

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

## 🛠️ 利用可能なツール

### 1. ログ確認スクリプト
```bash
./test_logs.sh
```
- processVideoJobのログ
- 全体ログ（最新20件）
- エラーログ（最新10件）

### 2. リアルタイムログ監視
```bash
./watch_logs.sh
```
- 10秒ごとに自動更新
- Ctrl+Cで停止

---

## 💪 システムの堅牢性

このシステムは、以下の堅牢性を実現しています：

1. **エラー耐性:** Dify APIが500エラーを返しても、システム全体が停止しない
2. **フェイルセーフ:** LINE Webhookが誤って`processVideoJob`に送信されても、正しく処理される
3. **ユーザー体験:** 何があっても、ユーザーに応答を返す
4. **商用レベルの堅牢性:** 単に動くだけでなく、「何があっても、ユーザーに応答を返す」という品質

---

**最終更新:** 2025-11-08  
**ステータス:** 作戦要綱完成、テスト実施待ち ✅

**指揮官、最終テストを開始してください！**

