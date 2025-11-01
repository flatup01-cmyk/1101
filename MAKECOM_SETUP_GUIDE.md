# 🔧 Make.com導入実装ガイド（修正版）

## ⚠️ 重要: 現在の実装との整合性確認

Make.comシナリオを現在の実装に合わせて修正が必要です。

---

## 🔍 問題点と解決策

### 問題1: statusの値の不一致

**Make.comシナリオ**:
- 監視対象: `status = 'analysis_completed'`

**現在の実装**:
- Firestoreに書き込む値: `status = 'completed'`

**解決策**: Cloud Functionsを修正して `analysis_completed` に書き込む、またはMake.comのトリガーを `completed` に変更

---

### 問題2: Firestoreフィールド構造の不一致

**Make.comシナリオ**:
- `{{1.scores.punch_speed}}` を参照

**現在の実装**:
- `analysis_result` というフィールドにスコアが保存される可能性

**解決策**: Firestoreドキュメント構造を確認し、Make.comの参照を修正

---

## 📋 修正されたMake.comシナリオ

### ステップ1: Firestoreトリガー設定（修正版）

```
Collection Name: video_jobs

Clauses:
  Field Path: status
  Operator: Equal to
  Value: analysis_completed  ← または 'completed'（実装に合わせる）
```

**重要**: もしCloud Functionsが `completed` を書き込んでいる場合、Make.comのトリガーを以下に変更してください：

```
Value: completed  ← こちらを使用
```

---

### ステップ2: Dify API呼び出し（修正版）

Make.comのHTTPリクエストのBodyを以下に修正：

```json
{
  "inputs": {
    "punch_speed_score": "{{1.analysis_result.punch_speed}}",
    "guard_stability_score": "{{1.analysis_result.guard_stability}}",
    "kick_height_score": "{{1.analysis_result.kick_height}}",
    "core_rotation_score": "{{1.analysis_result.core_rotation}}"
  },
  "response_mode": "blocking",
  "user": "{{1.userId}}"
}
```

**注意**: 
- `scores` → `analysis_result` に変更
- Make.comのモジュール1（Firestore）で実際に取得されるフィールド名を確認してください

---

### ステップ3: LINE API送信（修正版）

```
To: {{1.userId}}

Messages:
  Type: Text
  Text: {{2.data.answer}}  ← または {{2.answer}}
```

**注意**: Dify APIのレスポンス構造によっては `{{2.data.answer}}` または `{{2.answer}}` を使用してください。Make.comの実行履歴で確認可能です。

---

### ステップ4: Firestore更新（修正版）

Make.comシナリオでは `status: 'notification_sent'` に更新していますが、現在の実装では別の方法を推奨します。

**オプション1: statusフィールドを更新（Make.comシナリオ通り）**

```
Field Path: status
Field Value: notification_sent
```

**オプション2: notification_sentフラグを更新（現在の実装に合わせる）**

```
Field Path: notification_sent
Field Value: true
```

---

## 🔧 Cloud Functionsの修正（Make.com対応版）

Make.comを使用する場合、Cloud Functionsで `analysis_completed` ステータスを書き込むように修正：

```python
# functions/main.py の修正箇所（283-300行目付近）

# 4. Dify APIに送信してAIKAのセリフを生成（Make.com使用時はスキップ）
make_webhook_url = os.environ.get('MAKE_WEBHOOK_URL', '')

if make_webhook_url:
    # Make.comを使用する場合: 解析結果をMake.comに送信し、ステータスを 'analysis_completed' に更新
    processing_doc_ref.update({
        'status': 'analysis_completed',  # Make.comが監視するステータス
        'analysis_result': analysis_result['scores'],
        'updated_at': firestore.SERVER_TIMESTAMP
    })
    
    # Make.com Webhookを呼び出し（オプション、またはMake.comが自動検知）
    # requests.post(make_webhook_url, json={...})
else:
    # Make.comを使用しない場合: 現行の実装（直接Dify/LINE APIを呼び出し）
    aika_message = call_dify_api(analysis_result['scores'], user_id)
    if not aika_message:
        logger.warning("⚠️ Dify APIからメッセージが取得できませんでした")
        aika_message = "ふふ、動画を受け取ったわ。解析中よ。しばらくお待ちなさい。"
    
    notification_sent = send_line_message_with_retry(user_id, aika_message, unique_id)
    
    processing_doc_ref.update({
        'status': 'completed',
        'analysis_result': analysis_result['scores'],
        'aika_message': aika_message,
        'notification_sent': notification_sent,
        'completed_at': firestore.SERVER_TIMESTAMP,
        'updated_at': firestore.SERVER_TIMESTAMP
    })
```

---

## 📊 実装パターン比較

### パターンA: Make.com完全自動型（推奨）

```
Cloud Functions
  ├─ MediaPipe解析
  └─ Firestore更新: status = 'analysis_completed'
       ↓ (自動検知)
Make.com
  ├─ Firestore監視トリガー
  ├─ Dify API呼び出し
  ├─ LINE API送信
  └─ Firestore更新: status = 'notification_sent'
```

**メリット**:
- ✅ Cloud Functionsは解析のみに集中
- ✅ API連携をMake.comで視覚的に管理
- ✅ デバッグが容易（Make.comの実行履歴）

---

### パターンB: ハイブリッド型（現行実装を維持）

```
Cloud Functions
  ├─ MediaPipe解析
  ├─ Dify API呼び出し
  ├─ LINE API送信
  └─ Firestore更新: status = 'completed', notification_sent = true
```

**メリット**:
- ✅ 完全にコードベースで管理
- ✅ セキュリティ・冪等性が完璧
- ✅ Make.comの費用が不要

---

## 🎯 推奨実装プラン

### フェーズ1: Make.comシナリオの修正とテスト

1. **Firestoreトリガーの修正**
   - `status = 'analysis_completed'` → `status = 'completed'` に変更
   - または、Cloud Functionsで `analysis_completed` に書き込むように修正

2. **フィールド参照の確認**
   - Make.comで実際に取得されるフィールド名を確認
   - `{{1.analysis_result.punch_speed}}` が正しいか確認

3. **テスト実行**
   - 小規模でテスト実行
   - 実行履歴で各モジュールの入出力を確認

---

### フェーズ2: Cloud Functionsの修正（オプション）

Make.comを使用する場合のみ、Cloud Functionsを修正：

```python
# Make.com使用フラグ
USE_MAKECOM = os.environ.get('USE_MAKECOM', 'false').lower() == 'true'

if USE_MAKECOM:
    # Make.comが監視するステータスに更新
    processing_doc_ref.update({
        'status': 'analysis_completed',
        'analysis_result': analysis_result['scores'],
        'updated_at': firestore.SERVER_TIMESTAMP
    })
    # Make.comが自動検知して処理
else:
    # 現行の実装（直接Dify/LINE APIを呼び出し）
    # ...
```

---

## 🔍 Make.comシナリオのデバッグ方法

### 1. 実行履歴の確認

1. Make.comのシナリオページで「Execution history」を確認
2. 各モジュールをクリックして、入力・出力を確認
3. エラーがある場合は、詳細を確認

### 2. Firestoreデータの確認

Firebaseコンソールで `video_jobs` コレクションを確認：
- `status` フィールドの値
- `analysis_result` フィールドの構造
- `userId` フィールドの値

### 3. Dify APIレスポンスの確認

Make.comのHTTPモジュール（Dify API）の実行履歴で：
- レスポンスの構造を確認
- `answer` フィールドが存在するか確認
- 必要に応じて `{{2.data.answer}}` → `{{2.answer}}` に修正

---

## ⚠️ 重要な注意事項

### 1. 冪等性の保証

Make.comのシナリオにも冪等性チェックを追加することを推奨：

```
Firestoreモジュール（トリガー）
  ↓
Filterモジュール（オプション）
  Condition: notification_sent != true  ← 既に送信済みならスキップ
  ↓
Dify API呼び出し
  ↓
LINE API送信
  ↓
Firestore更新: notification_sent = true
```

### 2. エラーハンドリング

Make.comの「エラー処理」モジュールを追加：
- Dify API失敗時
- LINE API失敗時
- リトライ設定（オプション）

### 3. セキュリティ

- Make.comのAPIキーは安全に管理
- Firestoreのセキュリティルールを確認
- Make.comからのアクセスを許可

---

## 📝 チェックリスト

Make.com導入前の確認事項：

- [ ] Firestoreの `status` 値が `completed` か `analysis_completed` か確認
- [ ] Make.comのトリガー条件を実装に合わせて修正
- [ ] Firestoreドキュメントのフィールド名を確認（`analysis_result` vs `scores`）
- [ ] Dify APIのレスポンス構造を確認（`answer` vs `data.answer`）
- [ ] LINE APIのトークンをMake.comに設定
- [ ] テスト実行で動作確認
- [ ] エラーハンドリングを設定
- [ ] 冪等性チェックを追加（推奨）

---

**最終更新**: 2025-01-XX  
**作成者**: AI Assistant (Auto)

