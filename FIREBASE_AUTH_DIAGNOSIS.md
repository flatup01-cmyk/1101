# 🔍 Firebase認証エラー診断: `auth/configuration-not-found`

## ❌ エラー内容

```
auth/configuration-not-found
```

このエラーは、Firebase Authenticationが正しく設定されていない、または匿名認証が有効化されていないことを示します。

---

## ✅ 解決手順

### ステップ1: Firebase Consoleで匿名認証を有効化

1. **Firebase Consoleにアクセス**
   - https://console.firebase.google.com/project/aikaapp-584fa/authentication

2. **Sign-in methodタブを開く**

3. **匿名認証を有効化**
   - 「匿名」を探す
   - 「有効にする」をクリック
   - 「保存」をクリック

### ステップ2: Firebase Authentication APIが有効か確認

1. **Google Cloud Consoleにアクセス**
   - https://console.cloud.google.com/apis/library/identitytoolkit.googleapis.com?project=aikaapp-584fa

2. **Identity Toolkit APIが有効か確認**
   - 「有効にする」をクリック（無効の場合）

### ステップ3: 環境変数の再確認

Netlifyで以下が正しく設定されているか確認：
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`

