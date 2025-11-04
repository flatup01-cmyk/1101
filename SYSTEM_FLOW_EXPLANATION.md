# 🔄 AIKA18号 バトルスコープ システムフロー説明

## 📊 システム全体の流れ

```
【ユーザー】                    【Netlify】              【Firebase Storage】
    ↓                              ↓                           ↓
1. LINEアプリで動画アップロード
    ↓
2. ブラウザ（LIFF）で動画選択
    ↓
3. 「🚀 解析開始」ボタンクリック
    ↓                              ↓
4. Firebase Storageにアップロード
    ↓                              ↓
    └────────────────────────────→ 動画ファイル保存
                                         ↓
                                   【Cloud Functions】
                                         ↓
5. 自動トリガー（Storageイベント）
    ↓
6. 動画をダウンロード
    ↓
7. MediaPipeで解析
   - パンチ速度
   - ガード安定性
   - キック高さ
   - 体幹回転
    ↓
8. 解析スコアをDify APIに送信
    ↓                           【Dify API】
                                ↓
9. AIKA18号のセリフ生成
   （ツンデレ口調でフィードバック）
    ↓
10. LINE Messaging APIで送信
    ↓                           【LINE】
                                ↓
11. ユーザーのLINEにメッセージ到着
    ✅ 「…まあ、悪くないんじゃない？
       まぁ、このくらいできて当たり前だけどね。」
```

---

## 🔍 各ステップの詳細

### ステップ1-4: フロントエンド（LIFFアプリ）

**場所**: `src/main.js`, `src/firebase.js`

**処理内容**:
1. ユーザーが動画を選択
2. Firebase Anonymous認証でログイン
3. Firebase Storageにアップロード
   - パス: `videos/{userId}/{timestamp}-{filename}.mp4`

**現在の状態**: ✅ **完了**

---

### ステップ5: Cloud Functions自動トリガー

**場所**: `firebase.json`（要設定）, `functions/main.py`

**処理内容**:
- Firebase Storageにファイルが作成されると自動で関数が呼ばれる
- `process_video_trigger()` 関数が起動

**現在の状態**: ⚠️ **設定が必要**

`firebase.json` にStorageトリガーの設定を追加する必要があります。

---

### ステップ6: 動画ダウンロード

**場所**: `functions/main.py` (103-116行目)

**処理内容**:
- Cloud Storageから動画を一時ディレクトリにダウンロード

**現在の状態**: ✅ **実装済み**

---

### ステップ7: MediaPipeで解析

**場所**: `functions/analyze.py`

**処理内容**:
- MediaPipe Poseで骨格検出
- キックボクシングのフォームを分析
- 4つのスコアを計算:
  - `punch_speed`: パンチ速度
  - `guard_stability`: ガード安定性
  - `kick_height`: キック高さ
  - `core_rotation`: 体幹回転

**現在の状態**: ✅ **実装済み**

---

### ステップ8-9: Dify API連携

**場所**: `functions/main.py` (168-223行目)

**処理内容**:
1. 解析スコアをDify APIに送信
   ```python
   {
     'inputs': {
       'punch_speed_score': 75,
       'guard_stability_score': 80,
       'kick_height_score': 65,
       'core_rotation_score': 70
     }
   }
   ```
2. DifyがAIKA18号のセリフを生成
   - プロンプトに「ツンデレ」設定が含まれている
   - スコアに応じて反応が変わる

**現在の状態**: ⚠️ **実装済み（環境変数設定が必要）**

**必要な環境変数**:
- `DIFY_API_ENDPOINT`: Dify APIのエンドポイントURL
- `DIFY_API_KEY`: Dify APIキー

---

### ステップ10-11: LINE Messaging API連携

**場所**: `functions/main.py` (226-266行目)

**処理内容**:
1. Difyから受け取ったメッセージをLINE APIに送信
   ```python
   POST https://api.line.me/v2/bot/message/push
   {
     'to': user_id,
     'messages': [{'type': 'text', 'text': 'AIKA18号のセリフ'}]
   }
   ```
2. ユーザーのLINEアプリにメッセージが届く

**現在の状態**: ⚠️ **実装済み（環境変数設定が必要）**

**必要な環境変数**:
- `LINE_CHANNEL_ACCESS_TOKEN`: LINE Messaging APIのアクセストークン

---

## ⚠️ 現在の実装状況

### ✅ 完了している部分

1. **フロントエンド（LIFFアプリ）**
   - ✅ 動画アップロード機能
   - ✅ Firebase認証
   - ✅ UI（AIKA18号のツンデレ表示）

2. **バックエンド（Cloud Functions）**
   - ✅ 動画ダウンロード処理
   - ✅ MediaPipe解析処理
   - ✅ Dify API呼び出し
   - ✅ LINE API呼び出し
   - ✅ エラーハンドリング
   - ✅ レートリミット機能

### ⚠️ 設定が必要な部分

1. **Firebase Storageトリガーの設定**
   - `firebase.json` にStorageイベントトリガーを追加

2. **Cloud Functionsのデプロイ**
   - FunctionsをFirebaseにデプロイ

3. **環境変数の設定（Firebase）**
   - `DIFY_API_ENDPOINT`
   - `DIFY_API_KEY`
   - `LINE_CHANNEL_ACCESS_TOKEN`

4. **Dify APIの設定**
   - Difyワークフローの作成
   - APIエンドポイントの確認

---

## 🔧 次に必要な作業

詳しくは `SETUP_REMAINING_STEPS.md` を参照してください。

**最終更新**: 2025-11-01  
**状態**: コード実装完了、設定作業が必要







