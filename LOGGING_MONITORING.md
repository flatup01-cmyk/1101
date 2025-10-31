# 📊 ログ監視とアラート設定ガイド

## 📋 目的

サービス異常の早期発見と、問題の迅速な解決を実現します。

---

## 🔍 実装済みのログ出力

### Cloud Functions ログ

`functions/main.py`で以下のログを出力：

- ✅ 処理開始・終了
- ✅ レートリミットチェック結果
- ✅ 動画解析結果
- ✅ Dify API呼び出し結果
- ✅ LINE API呼び出し結果
- ✅ エラー詳細（スタックトレース付き）

**ログレベル:**
- `print()` → **INFO** レベル（通常の処理）
- `print(f"⚠️ ...")` → **WARNING** レベル（警告）
- `print(f"❌ ...")` → **ERROR** レベル（エラー）

---

## 📊 Firebase Consoleでのログ確認

### 1. Functionsログの確認

1. [Firebase Console](https://console.firebase.google.com/)にアクセス
2. プロジェクト: `aikaapp-584fa`
3. **「Functions」** → **「ログ」**

### 2. ログのフィルタリング

**検索キーワード例:**
- `❌` → エラーのみ表示
- `レートリミット超過` → レートリミット関連
- `process_video` → 動画処理関連
- `user_id:xxxxx` → 特定ユーザーのログ

---

## 🚨 アラート設定（推奨）

### 方法1: Firebase Consoleで監視（手動）

**定期的に確認する項目:**
- エラーログの有無
- レートリミット超過の頻度
- 処理時間の異常な増加

**確認頻度:** 週1回（推奨）

---

### 方法2: Cloud Monitoringで自動アラート（推奨）

#### 2.1 Cloud Monitoringにアクセス

1. [GCP Console](https://console.cloud.google.com/)にアクセス
2. **「監視」** → **「アラート」**

#### 2.2 アラートポリシーを作成

**アラート1: Cloud Functions エラー率**

1. **「アラート ポリシーを作成」**
2. **条件を追加:**
   - **メトリクス:** `cloudfunctions.googleapis.com/function/execution_count`
   - **フィルタ:** `severity="ERROR"`
   - **条件:** 5分間に10回以上のエラー
3. **通知チャネル:**
   - メール通知を設定

**アラート2: Cloud Functions 実行時間の異常**

1. **条件を追加:**
   - **メトリクス:** `cloudfunctions.googleapis.com/function/execution_times`
   - **条件:** 平均実行時間が5分を超える
3. **通知チャネル:**
   - メール通知を設定

**アラート3: Storage使用量の異常**

1. **条件を追加:**
   - **メトリクス:** `storage.googleapis.com/storage/total_bytes`
   - **条件:** 使用量が10GBを超える
3. **通知チャネル:**
   - メール通知を設定

---

## 📈 ダッシュボードの作成（オプション）

### Cloud Monitoringダッシュボード

1. **「監視」** → **「ダッシュボード」**
2. **「ダッシュボードを作成」**

**推奨ウィジェット:**
- Cloud Functions実行回数（時系列グラフ）
- エラー率（時系列グラフ）
- Storage使用量（ゲージ）
- Firestore読み書き操作数（時系列グラフ）

---

## 🔍 ログ分析のポイント

### 1. エラーパターンの特定

**確認事項:**
- 特定のユーザーからのエラーのみ？
- 特定の動画ファイル形式でのみエラー？
- 時間帯によるエラー集中？

**対応:**
- エラーパターンに応じてコード修正
- ユーザーサポート対応

---

### 2. パフォーマンス監視

**確認事項:**
- 平均実行時間の推移
- コールドスタートの頻度
- メモリ使用量

**対応:**
- 実行時間が長い場合、コード最適化
- コールドスタートが多い場合、予約インスタンスの検討

---

### 3. レートリミット超過の監視

**確認事項:**
- レートリミット超過の頻度
- 特定ユーザーからの集中アクセス

**対応:**
- 異常なアクセスパターンの場合、追加制限を検討
- ユーザーサポート対応

---

## 🛠️ ログの改善（今後の拡張）

### 構造化ログの導入（推奨）

`functions/main.py`でJSON形式のログを出力：

```python
import json
import logging

logger = logging.getLogger()

def log_event(event_type, **kwargs):
    """構造化ログを出力"""
    log_data = {
        'event_type': event_type,
        'timestamp': datetime.utcnow().isoformat(),
        **kwargs
    }
    logger.info(json.dumps(log_data))
```

**使用例:**
```python
log_event('video_upload_started', user_id=user_id, file_size=file_size)
log_event('video_analysis_completed', user_id=user_id, scores=scores)
log_event('rate_limit_exceeded', user_id=user_id, action='upload_video')
```

---

## 📊 定期レポートの作成（オプション）

### Cloud Functionsで週次レポート生成

1. **Cloud Scheduler**で週次トリガーを作成
2. **Cloud Functions**で以下を実行:
   - 過去1週間のエラー率を集計
   - レートリミット超過回数を集計
   - 使用量統計を集計
   - LINEまたはメールで送信

---

## ✅ チェックリスト

### 初期設定
- [ ] Firebase Consoleでログ確認方法を理解
- [ ] Cloud Monitoringアラートを作成（エラー率）
- [ ] Cloud Monitoringアラートを作成（実行時間）
- [ ] 通知先メールアドレスを設定

### 定期確認
- [ ] 週1回、ログを確認
- [ ] エラーパターンを分析
- [ ] パフォーマンス指標を確認

### 改善（オプション）
- [ ] 構造化ログを導入
- [ ] ダッシュボードを作成
- [ ] 週次レポートを自動生成

---

## 🔗 参考リンク

- [Firebase Functions ログ](https://firebase.google.com/docs/functions/manage-functions#view_logs)
- [Cloud Monitoring ドキュメント](https://cloud.google.com/monitoring/docs)
- [Cloud Logging ドキュメント](https://cloud.google.com/logging/docs)

---

**最終更新:** 2025-01-XX
**作成者:** AI Assistant（Auto）

