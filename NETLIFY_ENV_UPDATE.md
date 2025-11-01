# 🔑 Netlify環境変数更新ガイド

## ✅ 新しいFirebase APIキー

```
AIzaSyBx4KankOaRUO_GA9WOZwJP0AWthBIrY74
```

---

## 📋 Netlifyで環境変数を更新する手順

### ステップ1: Netlify Consoleにアクセス

1. **Netlify Consoleを開く**
   - https://app.netlify.com/
   - サイト「aika18」を選択

### ステップ2: 環境変数を編集

1. **サイト設定を開く**
   - **Site settings** → **Environment variables**

2. **`VITE_FIREBASE_API_KEY` を探す**
   - 既存の環境変数リストから `VITE_FIREBASE_API_KEY` を探す
   - 「編集」（Edit）ボタンをクリック

3. **値を更新**
   - **Value** フィールドに新しいAPIキーを貼り付け：
     ```
     AIzaSyBx4KankOaRUO_GA9WOZwJP0AWthBIrY74
     ```
   - **重要**: 余分なスペースや改行を入れないように注意

4. **保存**
   - 「Save」または「更新」ボタンをクリック

### ステップ3: 再デプロイ

環境変数を更新すると、**自動的に再デプロイが開始されます**。

1. **「Deploys」タブを確認**
   - 新しいデプロイが開始されていることを確認

2. **デプロイ完了を待つ**
   - 約2-3分で完了します

3. **完了後、サイトを再読み込み**
   - `https://aika18.netlify.app?dev=true`
   - **ブラウザキャッシュをクリア**: `Cmd + Shift + R` (Mac)

---

## ✅ 確認方法

デプロイ完了後、F12でコンソールを開いて確認：

**正常な場合:**
```
✅ Firebase初期化成功
✅ 開発モード: Firebase匿名認証成功
ユーザーID: [UID]
```

**まだエラーの場合:**
- 環境変数が正しく更新されているか確認
- デプロイが完了しているか確認
- ブラウザキャッシュをクリア

---

## 📋 チェックリスト

- [ ] Netlify Consoleで環境変数を開いた
- [ ] `VITE_FIREBASE_API_KEY` を編集
- [ ] 新しいAPIキーを貼り付けた
- [ ] 保存した
- [ ] 再デプロイが開始された
- [ ] デプロイが完了した
- [ ] ブラウザキャッシュをクリアした
- [ ] 再度テストした

---

**最終更新:** 2025-01-XX  
**状態:** ⚠️ 環境変数更新が必要

