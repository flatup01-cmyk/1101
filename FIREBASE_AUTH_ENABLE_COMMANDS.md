# 🔐 Firebase匿名認証を有効化するコマンド

## ❌ 現在のエラー

```
auth/configuration-not-found
```

---

## ✅ 解決手順（必須）

### ステップ1: Firebase Consoleで匿名認証を有効化

**ブラウザで以下を開く:**

```
https://console.firebase.google.com/project/aikaapp-584fa/authentication/providers
```

**操作:**
1. 「Sign-in method」タブが開いていることを確認
2. 一覧から「**匿名**」を探す
3. 「**有効にする**」ボタンをクリック
4. 「**保存**」ボタンをクリック

**確認:**
- 「匿名」の状態が「**有効**」になっていること

---

### ステップ2: Identity Toolkit APIが有効か確認

**ブラウザで以下を開く:**

```
https://console.cloud.google.com/apis/library/identitytoolkit.googleapis.com?project=aikaapp-584fa
```

**操作:**
- 「有効にする」ボタンが表示されている場合 → クリック
- 「無効にする」ボタンが表示されている場合 → 既に有効（問題なし）

---

### ステップ3: Netlifyで再デプロイ

**Netlify Consoleで:**
1. Deploysタブを開く
2. 「Trigger deploy」ボタンをクリック
3. 「Deploy site」を選択
4. デプロイ完了を待つ（約2-3分）

---

### ステップ4: 動作確認

**ブラウザで（シークレットモード推奨）:**
```
https://aika18.netlify.app?dev=true
```

**F12でコンソールを確認:**
```
✅ Firebase初期化成功
✅ 開発モード: Firebase匿名認証成功
ユーザーID: [UID]
```

---

## 🔍 エラーが出る場合の診断

コンソールで以下を実行:

```javascript
// 環境変数の確認
console.log('API Key:', import.meta.env.VITE_FIREBASE_API_KEY?.substring(0, 20) + '...')
console.log('Auth Domain:', import.meta.env.VITE_FIREBASE_AUTH_DOMAIN)
console.log('Project ID:', import.meta.env.VITE_FIREBASE_PROJECT_ID)
```

---

**最終更新:** 2025-01-XX  
**状態:** ✅ 有効化手順完了

