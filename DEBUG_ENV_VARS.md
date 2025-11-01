# 🔍 環境変数デバッグガイド

## ❌ 問題: 古いAPIキーが使われている

コンソールのエラーを見ると、URLに古いAPIキーが含まれています:
```
AIzaSyDDy5_-jv0BQCCFIHyPgXvH7sBjE83mnp4
```

また、変な文字列も含まれています:
```
%20VITE_FIREBASE_AUTH_DOMAIN%3Daikaapp-584fa.firebaseapp.com
```

これは環境変数の読み込みに問題がある可能性があります。

---

## ✅ 解決手順

### ステップ1: Netlifyの環境変数を確認

1. **Netlify Consoleにアクセス**
   - https://app.netlify.com/
   - サイト「aika18」を選択

2. **環境変数を確認**
   - Site settings → Environment variables
   - `VITE_FIREBASE_API_KEY` の値を確認

**正しい値:**
```
AIzaSyBx4KankOaRUO_GA9WOZwJP0AWthBIrY74
```

**間違っている値の例:**
```
AIzaSyDDy5_-jv0BQCCFIHyPgXvH7sBjE83mnp4  ← 古いキー
AIzaSyBx4KankOaRUO_GA9WOZwJP0AWthBIrY74 VITE_FIREBASE_AUTH_DOMAIN=...  ← 余分な文字列
```

### ステップ2: 環境変数を正しく設定

もし値が間違っている場合:

1. **編集ボタンをクリック**
2. **Valueフィールドを完全にクリア**
3. **新しいAPIキーだけを貼り付け**:
   ```
   AIzaSyBx4KankOaRUO_GA9WOZwJP0AWthBIrY74
   ```
4. **余分なスペースや改行がないか確認**
5. **保存**

### ステップ3: 強制再デプロイ

環境変数を更新してもデプロイが開始されない場合:

1. **Deploysタブを開く**
2. **「Trigger deploy」→「Deploy site」をクリック**
3. **デプロイ完了を待つ**（約2-3分）

### ステップ4: ブラウザキャッシュを完全にクリア

1. **Chromeの設定を開く**
   - Cmd + , (Mac)
   - または、メニューから「設定」

2. **プライバシーとセキュリティ**
   - 「閲覧履歴データの削除」
   - 「キャッシュされた画像とファイル」にチェック
   - 「データを削除」をクリック

3. **または、シークレットモードで開く**
   - Cmd + Shift + N (Mac)
   - `https://aika18.netlify.app?dev=true`

---

## 🔍 デバッグ: 環境変数の値を確認

コンソール（F12）で以下を実行:

```javascript
console.log('API Key:', import.meta.env.VITE_FIREBASE_API_KEY)
console.log('Auth Domain:', import.meta.env.VITE_FIREBASE_AUTH_DOMAIN)
```

**正常な場合:**
```
API Key: AIzaSyBx4KankOaRUO_GA9WOZwJP0AWthBIrY74
Auth Domain: aikaapp-584fa.firebaseapp.com
```

**エラーの場合:**
```
API Key: undefined
または
API Key: AIzaSyDDy5_-jv0BQCCFIHyPgXvH7sBjE83mnp4  ← 古い値
```

---

## 📋 チェックリスト

- [ ] Netlifyで環境変数 `VITE_FIREBASE_API_KEY` の値を確認
- [ ] 値が新しいAPIキー（`AIzaSyBx4KankOaRUO_GA9WOZwJP0AWthBIrY74`）になっている
- [ ] 余分なスペースや文字列がない
- [ ] 保存した
- [ ] 再デプロイが完了した
- [ ] ブラウザキャッシュを完全にクリアした
- [ ] シークレットモードまたは新しいブラウザでテストした

---

**最終更新:** 2025-01-XX  
**状態:** ⚠️ 環境変数確認が必要

