# 🔑 Firebase APIキー設定確認ガイド

## ❌ エラー: `auth/api-key-not-valid`

### 問題
Firebase APIキーが無効または設定されていません。

---

## ✅ 解決方法

### ステップ1: Netlifyの環境変数を確認

1. **Netlify Consoleにアクセス**
   - https://app.netlify.com/

2. **サイト設定を開く**
   - サイト選択 → **Site settings** → **Environment variables**

3. **以下の環境変数を確認**

| 環境変数名 | 値の例 | 必須 |
|-----------|--------|------|
| `VITE_FIREBASE_API_KEY` | `AIzaSy...` | ✅ |
| `VITE_FIREBASE_AUTH_DOMAIN` | `aikaapp-584fa.firebaseapp.com` | ✅ |
| `VITE_FIREBASE_PROJECT_ID` | `aikaapp-584fa` | ✅ |
| `VITE_FIREBASE_STORAGE_BUCKET` | `aikaapp-584fa.appspot.com` | ✅ |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `639286700347` | ✅ |
| `VITE_FIREBASE_APP_ID` | `1:639286700347:web:...` | ✅ |

### ステップ2: 正しいAPIキーを取得

1. **Firebase Consoleにアクセス**
   - https://console.firebase.google.com/project/aikaapp-584fa/settings/general

2. **プロジェクト設定を開く**
   - 設定（⚙️） → **プロジェクトの設定**

3. **Web APIキーを確認**
   - **一般**タブ → **Web APIキー**
   - APIキーをコピー

4. **Netlifyに設定**
   - 環境変数 `VITE_FIREBASE_API_KEY` に貼り付け

### ステップ3: 再デプロイ

環境変数を変更した後：
1. Netlifyが自動的に再デプロイを開始
2. または、「Deploys」タブから「Trigger deploy」をクリック

---

## 🔍 確認方法

### コンソールで確認

F12でコンソールを開いて、以下を確認：

**正常な場合:**
```
✅ Firebase初期化成功
✅ 開発モード: Firebase匿名認証成功
ユーザーID: [UID]
```

**エラーの場合:**
```
❌ Firebase APIキーが設定されていません
または
❌ 開発モード: Firebase匿名認証失敗: auth/api-key-not-valid
```

---

## 💡 よくある間違い

### ❌ 間違い1: `NEXT_PUBLIC_` プレフィックスを使用
```
❌ NEXT_PUBLIC_FIREBASE_API_KEY
```

### ✅ 正しい: `VITE_` プレフィックスを使用
```
✅ VITE_FIREBASE_API_KEY
```

---

## 📋 チェックリスト

- [ ] Netlifyの環境変数に `VITE_FIREBASE_API_KEY` が設定されている
- [ ] 環境変数の値が正しい（Firebase Consoleの値と一致）
- [ ] 環境変数に余分なスペースや改行がない
- [ ] Netlifyで再デプロイが完了している
- [ ] ブラウザキャッシュをクリアしている

---

**最終更新:** 2025-01-XX  
**状態:** ✅ 確認手順追加済み

