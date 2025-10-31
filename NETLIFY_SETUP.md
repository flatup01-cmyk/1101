# Netlify環境変数設定ガイド

## 問題: 白い画面が表示される

原因：Netlifyのビルド時に環境変数が読み込まれていないため、LIFF初期化が失敗しています。

## 解決方法

### Netlify環境変数の設定

1. **Netlifyダッシュボードにアクセス**
   - https://app.netlify.com/ にログイン

2. **サイト設定を開く**
   - 対象サイト（aika18）を選択
   - 「Site settings」→「Environment variables」

3. **以下の環境変数を追加/確認**

Netlifyでは、**VITE_プレフィックス付き**の環境変数を設定してください：

```
VITE_LIFF_ID=2008276179-XxwM2QQD
VITE_FIREBASE_API_KEY=AIzaSyDDy5_-jv0BQCCFIHyPgXvH7sBjE83mnp4
VITE_FIREBASE_AUTH_DOMAIN=aikaapp-584fa.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=aikaapp-584fa
VITE_FIREBASE_STORAGE_BUCKET=aikaapp-584fa.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=639286700347
VITE_FIREBASE_APP_ID=1:639286700347:web:2216c51a5ebb126b516f1e
VITE_IMAGEKIT_PUBLIC_KEY=public_/O4TtNTHCR7pD9sVlfrOQ5yA2d4=
VITE_IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/FLATUPGYM
VITE_GOOGLE_SHEET_ID=1UOw5RYqZAR1_Cu5kqIm6Kg3vArwfBKFEs68pnO9nWS8
VITE_GOOGLE_PROJECT_ID=aikaapp-584fa
VITE_GCS_BUCKET_NAME=aikaapp-584fa.appspot.com
```

**注意**: Netlifyでは`NEXT_PUBLIC_`ではなく`VITE_`プレフィックスを使用します。

### 環境変数設定後の再デプロイ

1. **環境変数を設定後、自動で再デプロイがトリガーされます**
   - または、「Deploys」タブから「Trigger deploy」→「Deploy site」をクリック

2. **デプロイ完了後、サイトを確認**
   - 白い画面ではなく、エラーメッセージまたは正常な表示がされるはずです

### 修正内容

今回の修正で以下を実装しました：

1. ✅ **エラーハンドリング強化** - JavaScriptエラーで白い画面にならないように
2. ✅ **フォールバック表示** - 環境変数がなくても最低限のメッセージを表示
3. ✅ **グローバルエラーハンドラー** - 予期しないエラーをキャッチ
4. ✅ **タイムアウト処理** - LIFF初期化が長時間かかる場合の対策

## 確認方法

デプロイ後、サイトにアクセスして：

✅ **正常**: 「NEW WORLD」タイトルとメッセージが表示される  
⚠️ **エラー**: エラーメッセージが表示される（白い画面ではない）

エラーメッセージが出る場合は、コンソール（F12）で詳細を確認してください。

