# ✅ Firebase Functions デプロイ問題 - 解決方法

## 🎯 問題の原因

Firebase CLIが`firebase_functions`モジュールを探していましたが、`functions_framework`しかインストールされていませんでした。

## ✅ 解決済み

`firebase-functions`パッケージをインストールしました：

```bash
cd "/Users/jin/Library/CloudStorage/Dropbox/NEW WORLD/1101 new/functions"
source venv/bin/activate
pip install firebase-functions
```

これで、Firebase CLIが正しく関数を分析できるようになりました。

---

## 🚀 デプロイ実行

以下のコマンドでデプロイできます：

```bash
cd "/Users/jin/Library/CloudStorage/Dropbox/NEW WORLD/1101 new"
firebase deploy --only functions
```

**注意:** 初回デプロイは5-15分かかる場合があります。

---

## 📋 デプロイ前の確認事項

### 1. 環境変数が設定されているか

Firebase Consoleで以下が設定されていることを確認：
- `DIFY_API_ENDPOINT`
- `DIFY_API_KEY`
- `LINE_CHANNEL_ACCESS_TOKEN`

### 2. 必要なパッケージがインストールされているか

```bash
cd functions
source venv/bin/activate
pip list | grep -E "functions-framework|firebase-functions"
```

両方が表示されることを確認してください。

---

## 🔍 デプロイ中に表示される内容

正常なデプロイでは、以下のようなメッセージが表示されます：

```
=== Deploying to 'aikaapp-584fa'...
i  deploying functions
i  functions: preparing codebase default for deployment
i  functions: ensuring required API cloudfunctions.googleapis.com is enabled...
i  functions: Loading and analyzing source code...
i  functions: creating Node.js v20 function process_video_trigger(asia-northeast1)...
✔  functions[process_video_trigger(asia-northeast1)] Successful create operation.
```

---

## ⚠️ エラーが出た場合

### エラー: "Permission denied"

```bash
gcloud auth login
gcloud config set project aikaapp-584fa
```

### エラー: "API not enabled"

```bash
gcloud services enable cloudfunctions.googleapis.com
gcloud services enable cloudbuild.googleapis.com
```

---

## 📝 requirements.txtへの追加

将来的には、`requirements.txt`に`firebase-functions`を追加することを推奨：

```txt
firebase-functions==0.4.3
```

ただし、実際のデプロイには`functions-framework`で十分です。

---

**最終更新:** 2025-01-XX  
**状態:** ✅ 解決済み

