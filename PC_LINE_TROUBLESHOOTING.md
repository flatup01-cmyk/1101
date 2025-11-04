# 💻 PC版LINE トラブルシューティングガイド

## ❌ 問題: 「このアプリはLINEアプリ内でのみ動作します」と表示される

### 🔍 原因

通常のブラウザ（Chrome、Safari、Firefoxなど）でLIFF URLを開いている可能性があります。

---

## ✅ 解決方法

### **正しい手順: LINEアプリ内で開く**

1. **PC版LINEデスクトップアプリを起動**
   - Windows: LINE for Windows
   - Mac: LINE for Mac

2. **自分にメッセージを送る**
   - LINEアプリ内で「自分」または任意のチャットを開く

3. **LIFF URLを貼り付け**
   ```
   https://liff.line.me/2008276179-XxwM2QQD
   ```

4. **URLをクリック**
   - ⚠️ **重要**: LINEアプリ内でクリックしてください
   - LINEアプリの内蔵ブラウザが自動的に開きます

---

## 🔍 診断情報の確認

更新されたコードでは、エラーメッセージに詳細な診断情報が表示されます：

### 表示される情報:
- **URL**: 現在開いているURL
- **User Agent**: ブラウザの種類
- **LIFF ID**: 設定されているLIFF ID

### 確認方法:
1. エラーメッセージの「診断情報」セクションを確認
2. ブラウザのコンソール（F12）を開いて詳細なログを確認

---

## 📊 動作確認チェックリスト

### ✅ PC版LINEで正常に動作する条件:

- [ ] LINEデスクトップアプリが起動している
- [ ] LIFF URLをLINEアプリ内で開いている
- [ ] 通常のブラウザ（Chrome/Safari）で開いていない
- [ ] LIFF IDが正しく設定されている

### ❌ 動作しない原因:

- [ ] 通常のブラウザで開いている
- [ ] LINE Developer ConsoleでLIFFアプリが非公開になっている
- [ ] LIFF URLが間違っている
- [ ] Netlifyの環境変数（`VITE_LIFF_ID`）が設定されていない

---

## 🛠️ デバッグ手順

### ステップ1: ブラウザのコンソールを確認

1. エラーが表示されている画面で **F12** キーを押す
2. **Console（コンソール）**タブを開く
3. 以下のログを確認:
   - `🔍 LIFF環境診断:` - 環境情報
   - `✅ LIFF初期化成功:` - 初期化成功時
   - `❌ LIFF initialization failed:` - エラー時

### ステップ2: 診断情報を確認

エラーメッセージに表示される診断情報を確認:
- **URL**: `aika18.netlify.app` が表示されている場合 → 通常のブラウザで開いている
- **User Agent**: Chrome/Safari/Firefox → 通常のブラウザ
- **User Agent**: LINE → LINEアプリ内

---

## 💡 よくある間違い

### ❌ 間違い1: NetlifyのURLを直接ブラウザで開く
```
❌ https://aika18.netlify.app をChromeで開く
```

### ✅ 正しい方法: LIFF URLをLINEアプリ内で開く
```
✅ https://liff.line.me/2008276179-XxwM2QQD をLINEアプリ内で開く
```

---

## 🔗 関連リンク

- **LINE Developers Console**: https://developers.line.biz/console/
- **LIFFアプリ設定**: https://developers.line.biz/console/channel/{チャネルID}/liff
- **Netlify**: https://app.netlify.com/

---

**最終更新:** 2025-01-XX  
**状態:** ✅ 診断機能追加済み






