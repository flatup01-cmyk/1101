# 💬 AIKA18号 自動会話機能 実装計画

## 📋 概要

AIKA18号が自動でユーザーに会話を送り、ジムへの誘導を行う機能を追加します。

## ✅ 実現可能性：**無料範囲内で可能**

### 使用するサービスと無料枠

1. **LINE Messaging API**
   - 無料枠: **月500通まで無料**
   - 超過分: 約0.3円/通

2. **Dify API**
   - 無料プラン利用可能
   - 基本的なチャットボット機能は無料範囲内

3. **Cloud Functions（定期実行）**
   - 無料枠: 月200万回まで無料
   - 定期実行（1日1回×30日 = 30回/月）→ **完全無料**

4. **Cloud Scheduler**
   - 無料枠: 月3ジョブまで無料
   - 1ジョブで十分 → **完全無料**

## 🎯 実装機能

### 機能1: 定期的な声かけ（毎日1回）

**例**:
- 「今日も動画を送ってきたら？」（朝の声かけ）
- 「最近動画が来ないけど、練習してる？」（3日連続で動画がない場合）
- 「ジムで本格的に練習してみない？」（定期的な誘導）

### 機能2: ジムへの誘導メッセージ

**例**:
- 「このフォーム、ジムで指導を受けた方がいいわよ」
- 「もっと上達したいなら、ジムに来てみなさい。…別にあなたが来たいから言ってるわけじゃないからね」
- 「ジムの体験レッスン、一緒に行かない？」（誘導リンク付き）

### 機能3: 会話のコンテキスト管理

- Firestoreに会話履歴を保存
- ユーザーの反応に応じて会話内容を変える
- ジムへの誘導が適切なタイミングで行われる

## 🔧 実装方法

### ステップ1: 自動会話用のCloud Functionsを作成

```python
# functions/send_daily_message.py
def send_daily_conversation():
    """
    毎日1回、全ユーザーに自動会話を送信
    Cloud Schedulerで定期実行
    """
    # 1. Firestoreから全ユーザーIDを取得
    # 2. 各ユーザーに対して：
    #    - 最後の動画アップロード日を確認
    #    - Dify APIで適切なメッセージを生成
    #    - LINE APIで送信
```

### ステップ2: Difyワークフローを拡張

既存の動画解析ワークフローとは別に、**自動会話用ワークフロー**を作成：

**入力変数**:
- `days_since_last_upload`: 最後の動画アップロードから何日経過
- `total_uploads`: 総アップロード回数
- `last_score_average`: 最後の解析スコアの平均

**プロンプト例**:
```
あなたはAIKA18号、ツンデレなキャラクターです。

ユーザー情報:
- 最後の動画アップロード: {days_since_last_upload}日前
- 総アップロード回数: {total_uploads}回
- 最後のスコア平均: {last_score_average}点

上記情報を元に、適切なタイミングでジムへの誘導を行う会話を生成してください。
ツンデレ口調で、自然にジムの体験レッスンを提案してください。
```

### ステップ3: Cloud Schedulerで定期実行

- **実行頻度**: 毎日午前10時（ユーザーが活動している時間）
- **実行内容**: 全ユーザーに自動会話を送信

### ステップ4: Firestoreでユーザー情報を管理

**コレクション構造**:
```
users/{userId}
  - last_upload_date: タイムスタンプ
  - total_uploads: 数値
  - last_score_average: 数値
  - gym_invitation_sent: boolean（ジム誘導メッセージ送信済みか）
  - conversation_history: 配列（会話履歴）
```

## 💰 コスト試算（無料枠内で実現可能）

### シナリオ1: 100人のユーザー

- 自動会話: 100人 × 30日 = 3,000通/月
- **LINE無料枠**: 500通/月
- **超過分**: 2,500通 × 0.3円 = **約750円/月**

### シナリオ2: 50人のユーザー

- 自動会話: 50人 × 30日 = 1,500通/月
- **LINE無料枠**: 500通/月
- **超過分**: 1,000通 × 0.3円 = **約300円/月**

### シナリオ3: 10人のユーザー（初期段階）

- 自動会話: 10人 × 30日 = 300通/月
- **LINE無料枠**: 500通/月
- **超過分**: **0円（完全無料）**

## 🎨 会話パターンの例

### パターン1: 毎日の声かけ

```
AIKA18号: 「今日も動画を送ってきたら？…別にあなたが来てほしいわけじゃないからね」
```

### パターン2: 動画が来ない場合（3日連続）

```
AIKA18号: 「最近動画が来ないけど、練習してるの？それとも飽きたの？」
→ 「ジムで本格的に練習してみない？体験レッスンがあるわよ」
```

### パターン3: スコアが低い場合

```
AIKA18号: 「このフォーム、まだまだよ。ジムで指導を受けた方がいいわ」
→ 「ジムの体験レッスン、一緒に行かない？…別にあなたが来たいから言ってるわけじゃないからね」
```

### パターン4: スコアが高い場合

```
AIKA18号: 「最近の動画、悪くないじゃない。でも、もっと上達したいならジムに来てみなさい」
```

## ⚠️ 注意事項

### 1. ユーザーの同意

- 自動メッセージを送信する前に、ユーザーに同意を得る必要があります
- LIFFアプリで「自動メッセージを受け取る」オプションを追加

### 2. メッセージ頻度の制限

- 1日1回まで
- ユーザーが「停止」を選択できる機能

### 3. LINE Messaging APIの制限

- **無料枠**: 月500通まで
- ユーザー数が増えると、超過分の費用が発生

## 🚀 実装ステップ

### フェーズ1: 基本的な自動会話機能（無料枠内）

1. ✅ 自動会話用Cloud Functionsを作成
2. ✅ Difyワークフローを拡張
3. ✅ Cloud Schedulerで定期実行を設定
4. ✅ Firestoreでユーザー情報を管理

**コスト**: ユーザー数10人以下なら完全無料

### フェーズ2: ジム誘導機能

1. ✅ ジムの体験レッスンリンクを含むメッセージ
2. ✅ ユーザーの反応を記録（Firestore）
3. ✅ 誘導効果を測定

**コスト**: 同上

### フェーズ3: 高度な会話機能（将来）

1. ユーザーの反応に応じた会話の最適化
2. 複数の会話パターンを自動選択
3. A/Bテスト機能

## 📝 実装コード例

### functions/send_daily_message.py

```python
"""
毎日1回、全ユーザーに自動会話を送信
Cloud Schedulerで定期実行される
"""

import os
import requests
from google.cloud import firestore
from datetime import datetime, timedelta

# Firestoreクライアント
db = firestore.Client()

# 環境変数
DIFY_API_ENDPOINT = os.environ.get('DIFY_AUTO_CONVERSATION_ENDPOINT', '')
DIFY_API_KEY = os.environ.get('DIFY_API_KEY', '')
LINE_CHANNEL_ACCESS_TOKEN = os.environ.get('LINE_CHANNEL_ACCESS_TOKEN', '')


def send_daily_conversation(request):
    """
    Cloud Schedulerから呼ばれる関数
    全ユーザーに自動会話を送信
    """
    print("💬 自動会話送信を開始します...")
    
    # Firestoreから全ユーザーIDを取得
    users_ref = db.collection('users')
    users = users_ref.stream()
    
    sent_count = 0
    error_count = 0
    
    for user_doc in users:
        user_id = user_doc.id
        user_data = user_doc.to_dict()
        
        # ユーザーの情報を取得
        last_upload = user_data.get('last_upload_date')
        total_uploads = user_data.get('total_uploads', 0)
        last_score_avg = user_data.get('last_score_average', 0)
        
        # 最後のアップロードから何日経過したか
        if last_upload:
            days_since = (datetime.now() - last_upload.to_datetime()).days
        else:
            days_since = 999  # まだアップロードしていない
        
        # Dify APIでメッセージを生成
        message = generate_aika_message(
            days_since_last_upload=days_since,
            total_uploads=total_uploads,
            last_score_average=last_score_avg
        )
        
        if message:
            # LINE APIで送信
            success = send_line_message(user_id, message)
            if success:
                sent_count += 1
                print(f"✅ 送信成功: {user_id}")
            else:
                error_count += 1
                print(f"❌ 送信失敗: {user_id}")
    
    return {
        "status": "success",
        "sent_count": sent_count,
        "error_count": error_count
    }


def generate_aika_message(days_since_last_upload, total_uploads, last_score_average):
    """
    Dify APIでAIKA18号のメッセージを生成
    """
    if not DIFY_API_ENDPOINT or not DIFY_API_KEY:
        print("⚠️ Dify API設定がありません")
        return None
    
    try:
        headers = {
            'Authorization': f'Bearer {DIFY_API_KEY}',
            'Content-Type': 'application/json'
        }
        
        payload = {
            'inputs': {
                'days_since_last_upload': days_since_last_upload,
                'total_uploads': total_uploads,
                'last_score_average': last_score_average
            },
            'response_mode': 'blocking'
        }
        
        response = requests.post(
            DIFY_API_ENDPOINT,
            headers=headers,
            json=payload,
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            message = result.get('answer', result.get('text', ''))
            return message
        else:
            print(f"Dify APIエラー: {response.status_code}")
            return None
            
    except Exception as e:
        print(f"Dify API呼び出しエラー: {str(e)}")
        return None


def send_line_message(user_id, message):
    """
    LINE Messaging APIでメッセージを送信
    """
    if not LINE_CHANNEL_ACCESS_TOKEN:
        return False
    
    try:
        url = 'https://api.line.me/v2/bot/message/push'
        headers = {
            'Authorization': f'Bearer {LINE_CHANNEL_ACCESS_TOKEN}',
            'Content-Type': 'application/json'
        }
        
        payload = {
            'to': user_id,
            'messages': [
                {
                    'type': 'text',
                    'text': message
                }
            ]
        }
        
        response = requests.post(url, headers=headers, json=payload, timeout=10)
        return response.status_code == 200
        
    except Exception as e:
        print(f"LINE APIエラー: {str(e)}")
        return False
```

## ✅ チェックリスト

- [ ] 自動会話用Cloud Functionsを作成
- [ ] Difyワークフローを拡張（自動会話用）
- [ ] Firestoreでユーザー情報を管理
- [ ] Cloud Schedulerで定期実行を設定
- [ ] ユーザー同意機能を追加（LIFFアプリ）
- [ ] メッセージ停止機能を追加
- [ ] コスト監視アラートを設定

---

**結論**: **無料枠内で実現可能**（初期段階は完全無料、ユーザー数増加時も低コスト）

