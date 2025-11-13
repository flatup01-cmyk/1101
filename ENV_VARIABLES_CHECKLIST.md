# Netlify環境変数チェックリスト

## 設定済み ✅
- `VITE_LIFF_ID=2008276179-XxwM2QQD`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`

## 追加で設定が必要な環境変数

Netlifyの「Environment variables」画面で「Add a variable」をクリックして、以下を追加してください：

### Firebase設定（動画アップロード用）
```
✅ VITE_FIREBASE_API_KEY=AIzaSyDDy5_-jv0BQCCFIHyPgXvH7sBjE83mnp4
⬜ VITE_FIREBASE_AUTH_DOMAIN=aikaapp-584fa.firebaseapp.com
⬜ VITE_FIREBASE_PROJECT_ID=aikaapp-584fa
✅ VITE_FIREBASE_STORAGE_BUCKET=aikaapp-584fa.appspot.com
✅ VITE_FIREBASE_MESSAGING_SENDER_ID=639286700347
✅ VITE_FIREBASE_APP_ID=1:639286700347:web:2216c51a5ebb126b516f1e
```

### ImageKit設定（画像アップロード用）
```
VITE_IMAGEKIT_PUBLIC_KEY=public_/O4TtNTHCR7pD9sVlfrOQ5yA2d4=
VITE_IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/FLATUPGYM
```

### Google Cloud Storage設定
```
VITE_GOOGLE_PROJECT_ID=aikaapp-584fa
VITE_GCS_BUCKET_NAME=aikaapp-584fa.appspot.com
```

### Google Sheets設定
```
VITE_GOOGLE_SHEET_ID=1UOw5RYqZAR1_Cu5kqIm6Kg3vArwfBKFEs68pnO9nWS8
```

### Cloud Functions設定
```
VITE_NOTIFY_VIDEO_UPLOAD_URL=https://asia-northeast1-aikaapp-584fa.cloudfunctions.net/notifyVideoUpload
```

## 設定方法

1. Netlifyダッシュボード → 「Environment variables」
2. 「Add a variable」をクリック
3. **Key**: `VITE_FIREBASE_API_KEY` のように入力
4. **Value**: 上記の値を貼り付け
5. **Deploy context**: 「All contexts」（または必要に応じて選択）
6. 「Save」をクリック

## 設定後の確認

すべての環境変数を設定した後：

1. **自動再デプロイ**が開始されます
2. デプロイが完了したら、サイトにアクセスして確認
3. ブラウザのコンソール（F12）で環境変数の読み込み状況を確認

## 注意事項

- ✅ すべて`VITE_`プレフィックスが必要です
- ✅ `NEXT_PUBLIC_`プレフィックスは使用しません
- ✅ 機密情報（IMAGEKIT_PRIVATE_KEY等）はクライアント側では使用しません

