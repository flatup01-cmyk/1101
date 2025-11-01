# 🔍 Firebase環境変数完全チェックリスト

## ✅ 必須環境変数（全て設定されているか確認）

Netlifyの環境変数で以下が全て設定されているか確認してください：

| 環境変数名 | 値の例 | 必須 |
|-----------|--------|------|
| `VITE_FIREBASE_API_KEY` | `AIzaSyBx4KankOaRUO_GA9WOZwJP0AWthBIrY74` | ✅ |
| `VITE_FIREBASE_AUTH_DOMAIN` | `aikaapp-584fa.firebaseapp.com` | ✅ |
| `VITE_FIREBASE_PROJECT_ID` | `aikaapp-584fa` | ✅ |
| `VITE_FIREBASE_STORAGE_BUCKET` | `aikaapp-584fa.appspot.com` | ✅ |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `639286700347` | ✅ |
| `VITE_FIREBASE_APP_ID` | `1:639286700347:web:2216c51a5ebb126b516f1e` | ✅ |

---

## ⚠️ よくある間違い

### ❌ 間違い1: 末尾にスラッシュがある
```
❌ VITE_FIREBASE_AUTH_DOMAIN=aikaapp-584fa.firebaseapp.com/
```

### ✅ 正しい: スラッシュなし
```
✅ VITE_FIREBASE_AUTH_DOMAIN=aikaapp-584fa.firebaseapp.com
```

### ❌ 間違い2: スペースが含まれている
```
❌ VITE_FIREBASE_API_KEY= AIzaSyBx4KankOaRUO_GA9WOZwJP0AWthBIrY74
```

### ✅ 正しい: スペースなし
```
✅ VITE_FIREBASE_API_KEY=AIzaSyBx4KankOaRUO_GA9WOZwJP0AWthBIrY74
```

---

## 📋 確認手順

1. **Netlify Consoleにアクセス**
   - インコグニートモードまたは拡張機能無効化
   - https://app.netlify.com/

2. **環境変数を確認**
   - Site settings → Environment variables
   - 上記6つの環境変数が全て設定されているか確認

3. **値の正確性を確認**
   - スペース、スラッシュ、改行がないか確認
   - 値が正しく設定されているか確認

4. **再デプロイを実行**
   - Deploysタブ → 「Trigger deploy」→ 「Deploy site」

5. **デプロイ完了を待つ**
   - 約2-3分

6. **動作確認**
   - ブラウザキャッシュをクリア
   - シークレットモードでテスト
   - F12でコンソールを確認

---

**最終更新:** 2025-01-XX  
**状態:** ✅ 確認手順追加済み

