# 🔐 Firebase匿名認証を有効化する手順

## ❌ エラー: `auth/configuration-not-found`

このエラーは、**Firebase Authenticationで匿名認証が有効化されていない**ことを示します。

---

## ✅ 解決手順

### ステップ1: Firebase Consoleで匿名認証を有効化（必須）

1. **Firebase Consoleにアクセス**
   - https://console.firebase.google.com/project/aikaapp-584fa/authentication/providers

2. **Sign-in methodタブを確認**
   - 左側のメニューから「Authentication」→「Sign-in method」をクリック

3. **匿名認証を有効化**
   - 一覧から「**匿名**」を探す
   - 「**有効にする**」ボタンをクリック
   - 「**保存**」ボタンをクリック

**重要な確認:**
- 「匿名」の状態が「**有効**」になっていること
- エラーが出ないこと

---

### ステップ2: Identity Toolkit APIが有効か確認

1. **Google Cloud Consoleにアクセス**
   - https://console.cloud.google.com/apis/library/identitytoolkit.googleapis.com?project=aikaapp-584fa

2. **Identity Toolkit APIの状態を確認**
   - 「有効にする」ボタンが表示されている場合 → クリックして有効化
   - 「無効にする」ボタンが表示されている場合 → 既に有効（問題なし）

---

### ステップ3: Netlifyで再デプロイ

1. **Netlify Console → Deploysタブ**
   - https://app.netlify.com/

2. **「Trigger deploy」→「Deploy site」をクリック**

3. **デプロイ完了を待つ**（約2-3分）

---

### ステップ4: 動作確認

デプロイ完了後：

1. **シークレットモードで開く**
   - `https://aika18.netlify.app?dev=true`

2. **F12でコンソールを確認**
   - 正常な場合:
     ```
     ✅ Firebase初期化成功
     ✅ 開発モード: Firebase匿名認証成功
     ユーザーID: [UID]
     ```

---

## 🔍 確認チェックリスト

- [ ] Firebase Console → Authentication → Sign-in method で「匿名」が有効になっている
- [ ] Google Cloud Consoleで Identity Toolkit API が有効になっている
- [ ] Netlifyで再デプロイを実行した
- [ ] デプロイが完了した
- [ ] シークレットモードでテストした
- [ ] コンソールに「✅ 開発モード: Firebase匿名認証成功」が表示される

---

## 📋 重要なURL

- **Firebase Console（匿名認証設定）:**
  https://console.firebase.google.com/project/aikaapp-584fa/authentication/providers

- **Google Cloud Console（Identity Toolkit API）:**
  https://console.cloud.google.com/apis/library/identitytoolkit.googleapis.com?project=aikaapp-584fa

---

**最終更新:** 2025-01-XX  
**状態:** ✅ 有効化手順追加済み





