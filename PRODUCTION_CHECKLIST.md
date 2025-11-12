# 本番運用前チェックリスト

## 📋 チェック項目

### 1. エラー監視の整備 ✅

#### Cloud Loggingアラート設定

**対象エラー:**
- 動画解析失敗 (`CRITICAL: 動画処理エラー`)
- LINE API 4xx/5xx (`LINE API送信失敗`)
- Secret Manager読み込みエラー
- Dify API呼び出しエラー

**設定手順:**

```bash
# Cloud Loggingでメトリクスを作成
gcloud logging metrics create video_processing_errors \
  --description="動画処理エラーの監視" \
  --log-filter='severity>=ERROR AND jsonPayload.message=~"CRITICAL: 動画処理エラー"'

gcloud logging metrics create line_api_errors \
  --description="LINE APIエラーの監視" \
  --log-filter='severity>=ERROR AND jsonPayload.message=~"LINE API"'

# アラートポリシーを作成（通知先: Email）
# 注意: CHANNEL_IDは事前に作成した通知チャネルのIDに置き換える
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="動画処理エラーアラート" \
  --condition-display-name="動画処理エラー検出" \
  --condition-threshold-value=1 \
  --condition-threshold-duration=300s
```

**推奨設定:**
- エラー発生時の通知先: Email + Slack（オプション）
- 閾値: 5分間に1回以上のエラー
- 通知頻度: 1時間に1回まで

**確認コマンド:**

```bash
# エラーログを確認
gcloud logging read 'severity>=ERROR' \
  --limit=50 \
  --format=json \
  --project=aikaapp-584fa
```

---

### 2. 設定の固定化 🔧

#### 環境変数の登録

**Firebase Functions環境変数:**

```bash
# PROCESS_VIDEO_JOB_URLを環境変数として設定
firebase functions:config:set \
  process_video_job.url="https://processvideojob-kvuv4ufotq-an.a.run.app"

# または、Firebase Consoleから設定:
# Functions → 設定 → 環境変数 → PROCESS_VIDEO_JOB_URL を追加
```

**Secret Managerのバージョン固定:**

現在のコードでは`latest`を使用していますが、本番運用時は特定バージョンを指定することを推奨:

```python
# functions/main.py の修正例
LINE_CHANNEL_ACCESS_TOKEN = access_secret_version(
    "LINE_CHANNEL_ACCESS_TOKEN",
    PROJECT_ID,
    version_id="4"  # バージョン4に固定
).strip()
```

**確認事項:**
- [x] `PROCESS_VIDEO_JOB_URL`が環境変数から読み込まれている（`functions/index.js`で確認済み）
- [ ] Secret Managerのバージョン指定を検討（現在は`latest`）
- [ ] ハードコードされたURLがない

**現在の状態:**
- ✅ `PROCESS_VIDEO_JOB_URL`: 環境変数から読み込み（`process.env.PROCESS_VIDEO_JOB_URL`）
- ⚠️ `LINE_CHANNEL_ACCESS_TOKEN`: Secret Managerから`latest`で取得（バージョン固定を推奨）

---

### 3. 端末/形式の追加テスト 📱

#### テスト計画

**対象端末・形式:**

| 端末 | 形式 | サイズ | 長さ | テスト項目 |
|------|------|--------|------|-----------|
| iPhone | video/quicktime (.mov) | 10-50MB | 5-20秒 | アップロード→処理→LINE送信 |
| Android | video/mp4 | 10-50MB | 5-20秒 | アップロード→処理→LINE送信 |
| PC | video/mp4 | 50-100MB | 10-20秒 | アップロード→処理→LINE送信 |

**テスト手順:**

1. **動画準備**
   - iPhone: カメラアプリで動画撮影（5秒、20秒）
   - Android: カメラアプリで動画撮影（5秒、20秒）
   - PC: サンプル動画を使用

2. **アップロードテスト**
   - LIFFアプリから動画をアップロード
   - 進捗表示が正常に動作するか確認
   - エラーメッセージが適切に表示されるか確認

3. **処理確認**
   - Cloud Functionsのログで処理状況を確認
   - 解析結果がFirestoreに保存されるか確認
   - 処理時間が許容範囲内か確認（20秒以内）

4. **LINE送信確認**
   - LINE Botからメッセージが届くか確認
   - メッセージ内容が正しいか確認
   - エラー時の再送が機能するか確認

**チェックリスト:**
- [ ] iPhone (video/quicktime, 5秒) - 成功
- [ ] iPhone (video/quicktime, 20秒) - 成功
- [ ] Android (video/mp4, 5秒) - 成功
- [ ] Android (video/mp4, 20秒) - 成功
- [ ] PC (video/mp4, 50MB) - 成功
- [ ] エラーケース（100MB超過） - 適切なエラーメッセージ
- [ ] エラーケース（20秒超過） - 適切なエラーメッセージ

---

### 4. 返答・UX確認 💬

#### LIFFアプリの確認

**確認項目:**
- [ ] LIFF認証が正常に動作する
- [ ] 動画アップロードフォームが表示される
- [ ] 進捗表示が適切に更新される
- [ ] エラーメッセージが分かりやすい
- [ ] 成功メッセージが表示される

**LINE Bot応答の確認:**

**正常系:**
- [ ] 動画受付メッセージが届く
- [ ] 解析完了メッセージが届く
- [ ] AIKAのキャラクター設定が反映されている

**エラー系:**
- [ ] ファイルサイズ超過時のメッセージ（「ごめんあそばせ。動画ファイルが大きすぎるわ（100MB以下に収めて）。」）
- [ ] 動画の長さ超過時のメッセージ（「ごめんあそばせ。動画が長すぎるわ（20秒以内に収めて）。」）
- [ ] ネットワークエラー時のメッセージ

**文言チェック:**
- [ ] ユーザーフレンドリーな表現
- [ ] エラーの原因が明確
- [ ] 次のアクションが分かる

---

### 5. 料金と上限の確認 💰

#### Cloud Run / Cloud Functions

**現在の設定:**
- 同時実行数: デフォルト（要確認）
- タイムアウト: 540秒（9分）
- メモリ: 2GB
- リージョン: asia-northeast1

**確認コマンド:**

```bash
# 現在の設定を確認
gcloud functions describe process_video_trigger \
  --gen2 \
  --region=asia-northeast1 \
  --format="value(serviceConfig.maxInstanceCount,serviceConfig.timeoutSeconds,serviceConfig.availableMemory)"

# クォータを確認
gcloud compute project-info describe --project=aikaapp-584fa \
  --format="value(quotas)" | grep -i "function\|run"
```

**推奨設定:**
- 最大同時実行数: 10（現在の設定を確認）
- タイムアウト: 540秒（現在の設定）
- メモリ: 2GB（現在の設定）

**レート制御:**

`functions/rate_limiter.py`で既に実装済み:
- ユーザーごとのアップロード制限
- 時間単位の制限

**確認事項:**
- [ ] レート制限が適切に機能している
- [ ] 制限超過時のメッセージが適切

#### GCS予算アラート

**設定手順:**

```bash
# 予算アラートを作成
# 注意: BILLING_ACCOUNT_IDは実際の請求アカウントIDに置き換える
gcloud billing budgets create \
  --billing-account=BILLING_ACCOUNT_ID \
  --display-name="GCS Storage予算アラート" \
  --budget-amount=10000 \
  --threshold-rule=percent=80 \
  --threshold-rule=percent=100
```

**推奨設定:**
- 月額予算: ¥10,000（要調整）
- アラート: 80%到達時、100%到達時

#### APIクォータ

**確認対象:**
- [ ] Cloud Storage API: 読み書きクォータ
- [ ] Firestore API: 読み書きクォータ
- [ ] LINE Messaging API: メッセージ送信クォータ（無料枠: 500メッセージ/月）
- [ ] Dify API: リクエストクォータ

**確認コマンド:**

```bash
# APIクォータを確認
gcloud services list --enabled --project=aikaapp-584fa

# LINE Messaging APIのクォータ確認
# LINE Developers Consoleで確認: https://developers.line.biz/console/
```

---

## 📊 監視ダッシュボード

### Cloud Logging クエリ例

**動画処理エラー:**
```
severity>=ERROR
jsonPayload.message=~"CRITICAL: 動画処理エラー"
```

**LINE APIエラー:**
```
severity>=ERROR
jsonPayload.message=~"LINE API"
```

**処理時間の監視:**
```
resource.type="cloud_function"
jsonPayload.message=~"処理完了"
```

**成功ログの確認:**
```
severity=INFO
jsonPayload.message=~"✅"
```

---

## ✅ 最終確認

### デプロイ前チェック

- [x] すべての環境変数が設定されている
- [x] Secret Managerのシークレットが最新
- [x] コードにハードコードがない（`PROCESS_VIDEO_JOB_URL`は環境変数から読み込み）
- [x] エラーハンドリングが適切
- [x] ログ出力が適切

### 本番運用開始後

- [ ] エラー監視が機能している
- [ ] アラート通知が届く
- [ ] 処理が正常に動作している
- [ ] ユーザーからのフィードバックを収集

---

## 📝 メンテナンス計画

### 定期確認項目

**毎日:**
- Cloud Loggingでエラーを確認
- 処理件数を確認

**毎週:**
- エラーログの分析
- パフォーマンスの確認

**毎月:**
- コストの確認
- クォータ使用状況の確認
- ユーザーフィードバックの確認

---

## 🔧 推奨される改善

1. **Secret Managerのバージョン固定**
   - 現在は`latest`を使用
   - 本番運用時は特定バージョン（例: バージョン4）に固定することを推奨

2. **エラー監視の自動化**
   - Cloud Loggingアラートの設定
   - Slack通知の追加（オプション）

3. **パフォーマンス監視**
   - 処理時間の追跡
   - リソース使用量の監視

---

**最終更新:** 2025-11-08
**ステータス:** 準備中
