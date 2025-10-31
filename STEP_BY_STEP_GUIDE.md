# 📖 ステップバイステップ統合ガイド（中学生向け）

## 🎯 目標を理解しよう

**今作っているもの：**
ユーザーが動画をアップロードすると、自動でAIKAが分析して、LINEで結果を送ってくれるシステム

---

## 📊 現在の状況チェック

### ✅ 完成しているもの
- [x] LIFFアプリ（ユーザーが動画をアップロードする画面）
- [x] 動画アップロードUI（ファイル選択、プレビュー）
- [x] Firebase Storage連携（動画を保存）
- [x] 動画解析プログラム（`analyze_video_scored.py`）

### ⏳ これから作るもの
- [ ] Cloud Functions（自動で解析を実行する仕組み）
- [ ] Dify API連携（AIKAのセリフを生成）
- [ ] LINE Messaging API連携（結果をユーザーに送る）

---

## 🚀 ステップ1: Cloud Functionsを準備する

### ステップ1-1: functionsフォルダを作る

**なぜ必要？**
→ Google Cloud Functionsは、特別なフォルダにコードを置かないと動かないから

**やり方：**
ターミナルで以下を実行：

```bash
cd "/Users/jin/Library/CloudStorage/Dropbox/NEW WORLD/1101 new"
mkdir functions
```

### ステップ1-2: requirements.txtを作る

**なぜ必要？**
→ Cloud Functionsで使うPythonライブラリを指定するため

**ファイル名：** `functions/requirements.txt`

**中身：**
```
opencv-python==4.12.0.88
mediapipe==0.10.14
google-cloud-storage==2.18.2
requests==2.31.0
```

### ステップ1-3: メインのコードを作る

**ファイル名：** `functions/main.py`

**このファイルの役割：**
1. Firebase Storageから動画をダウンロード
2. 解析プログラムを実行
3. 結果を返す

---

## 🚀 ステップ2: Cloud Functionsのコードを書く

### ステップ2-1: 基本的な構造

```python
# functions/main.py の基本構造

def process_video(request):
    """
    Firebase Storageから動画を取得して解析する関数
    """
    # 1. リクエストから動画のパスを取得
    # 2. 動画をダウンロード
    # 3. 解析実行
    # 4. 結果を返す
    pass
```

### ステップ2-2: トリガー設定

**トリガーとは？**
→ 「Firebase Storageに動画が保存されたら、この関数を自動で実行して」という設定

**設定方法：**
`firebase.json`というファイルで設定します

---

## 🚀 ステップ3: Dify APIと連携する

### ステップ3-1: Dify APIのエンドポイントを設定

**Difyとは？**
→ AIKAのセリフを自動で作ってくれるAIサービス

**必要な情報：**
- APIエンドポイント（URL）
- APIキー（パスワードのようなもの）

### ステップ3-2: 解析結果を送信

解析結果（例：パンチ速度85点、キック角度70点）をDifyに送ります。

### ステップ3-3: AIKAのセリフを受け取る

Difyが作ったAIKAのメッセージを受け取ります。

**例：**
「ふふ、あなたのパンチ速度は85点ね。悪くないわ。でも、ガードが少し甘いわよ。」

---

## 🚀 ステップ4: LINE Messaging APIで送信

### ステップ4-1: LINE APIの設定

**必要な情報：**
- Channel Access Token（LINEにメッセージを送るための認証）

### ステップ4-2: メッセージを送信

Difyから受け取ったAIKAのセリフを、ユーザーにLINEで送ります。

---

## ✅ 完成したときの流れ

1. **ユーザー**がLIFFアプリで動画を選択
2. **LIFFアプリ**がFirebase Storageに動画をアップロード
3. **Firebase Storage**が「新しい動画が保存された」と通知
4. **Cloud Functions**が自動で起動
5. **Cloud Functions**が動画をダウンロード
6. **Cloud Functions**が解析プログラムを実行
7. **解析結果**（JSON形式）ができる
8. **Cloud Functions**がDify APIに結果を送信
9. **Dify**がAIKAのセリフを生成
10. **Cloud Functions**がLINE Messaging APIでユーザーに送信
11. **ユーザー**がLINEで結果を受け取る ✨

---

## 📝 次のアクション

**今すぐできること：**

1. ✅ **ステップ1**: functionsフォルダを作る
2. ✅ **ステップ2**: requirements.txtを作る
3. ⏳ **ステップ3**: main.pyの基本構造を作る

**どれから始めますか？**

A. すべて一気に作る（functionsフォルダとファイルを一括作成）
B. 1つずつ確認しながら進める
C. まずはローカルでテストしてからCloud Functionsに移す

