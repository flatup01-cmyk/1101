# 🚀 デプロイ手順（ステップバイステップ）

## ✅ 準備完了

- ✅ Dify API Key: `app-6OBnNxu0oWUiMVVq0rjepVhJ`
- ✅ LINE Channel Access Token: 取得済み
- ✅ Firebase CLI: インストール済み
- ✅ コード: 完成済み

---

## 📋 ステップ1: Firebaseにログイン

```bash
cd "/Users/jin/Library/CloudStorage/Dropbox/NEW WORLD/1101 new"
firebase login
```

ブラウザが開くので、Googleアカウントでログイン

---

## 📋 ステップ2: Firebaseプロジェクトを確認

```bash
firebase projects:list
```

`aikaapp-584fa` が表示されることを確認

もし表示されない場合：
```bash
firebase use aikaapp-584fa
```

---

## 📋 ステップ3: Functionsを初期化（初回のみ）

```bash
firebase init functions
```

**選択肢：**
- ❓ Functionsを設定しますか？ → **Yes**
- ❓ 既存のプロジェクトを使用しますか？ → **Use an existing project**
- ❓ プロジェクトを選択 → **aikaapp-584fa**
- ❓ 言語を選択 → **Python**
- ❓ ESLintを使用しますか？ → **No**

**重要：** 既存の`functions/`フォルダがあるので、上書きしないように注意

---

## 📋 ステップ4: 環境変数を設定

### 方法A: Firebase Console（簡単・推奨）

1. https://console.firebase.google.com/project/aikaapp-584fa/functions/config
2. 「環境変数を追加」をクリック
3. 以下を3つ追加：

**環境変数1:**
- キー: `DIFY_API_ENDPOINT`
- 値: `https://api.dify.ai/v1/chat-messages`

**環境変数2:**
- キー: `DIFY_API_KEY`
- 値: `app-6OBnNxu0oWUiMVVq0rjepVhJ`

**環境変数3:**
- キー: `LINE_CHANNEL_ACCESS_TOKEN`
- 値: `dmEAWqyaDSsjpiTT4+i7YUD9I+nW2SV7O+i1XbjvIDMvbRP3CrJBG9kqGH34fZ98cQVfw9ldezkWUqlgLMBB1MtN1z2J/I2efQVA1grXYoz30SbK1DVVlzKu5PqEL91Px1FHoqUkzxPnTeAwoWWmlwdB04t89/1O/w1cDnyilFU=`

### 方法B: Firebase CLI

```bash
firebase functions:config:set \
  dify.api_endpoint="https://api.dify.ai/v1/chat-messages" \
  dify.api_key="app-6OBnNxu0oWUiMVVq0rjepVhJ" \
  line.channel_access_token="dmEAWqyaDSsjpiTT4+i7YUD9I+nW2SV7O+i1XbjvIDMvbRP3CrJBG9kqGH34fZ98cQVfw9ldezkWUqlgLMBB1MtN1z2J/I2efQVA1grXYoz30SbK1DVVlzKu5PqEL91Px1FHoqUkzxPnTeAwoWWmlwdB04t89/1O/w1cDnyilFU="
```

**注意：** この方法の場合、コード側も変更が必要です（後述）

---

## 📋 ステップ5: Firebase Storageトリガーを設定

`functions/main.py`をFirebase Storageトリガー用に調整する必要があります。

現在の実装を、Firebase Functions用の形式に変更：

```python
# Firebase Functions用のインポートを追加
from google.cloud.functions_v1.context import Context
from google.cloud.functions_v1.cloud_event import CloudEvent

# トリガー関数を定義
@functions_framework.cloud_event
def process_video_trigger(cloud_event: CloudEvent) -> None:
    """
    Firebase Storageトリガー関数
    """
    # CloudEventからデータを取得
    data = cloud_event.data
    return process_video(data, None)
```

---

## 📋 ステップ6: デプロイ

```bash
firebase deploy --only functions
```

**デプロイ時間：** 約5-10分（初回は長め）

---

## 📋 ステップ7: トリガー設定

Firebase Storageにトリガーを設定：

1. Firebase Console → Storage → ルール
2. トリガー設定で、`videos/`フォルダへのアップロードを監視
3. 関数: `process_video_trigger`

または、`firebase.json`に設定を追加

---

## ✅ 完了！

デプロイ後：
1. LIFFアプリで動画をアップロード
2. 自動でCloud Functionsが実行
3. 数分後にLINEで結果が届く ✨

## 🐛 トラブルシューティング

### エラー: "functions not found"
→ `firebase init functions`を実行

### エラー: "environment variable not found"
→ Firebase Consoleで環境変数を再確認

### エラー: "trigger not working"
→ Storageのトリガー設定を確認

