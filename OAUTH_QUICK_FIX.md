# ⚡ OAuthリダイレクトURI クイック修正ガイド

## 🎯 今すぐ確認・修正すべきポイント

### ⚠️ 最重要：リダイレクトURIの完全一致

Google Cloud Consoleの「承認済みのリダイレクトURI」に、**以下3つを完全一致で追加**してください：

```
https://www.make.com/oauth/cb
https://us2.make.com/oauth/cb
https://eu1.make.com/oauth/cb
```

---

## ❌ よくある間違いチェックリスト

以下の間違いをしていないか確認してください：

### 間違い1: 末尾スラッシュ
```
❌ https://www.make.com/oauth/cb/
✅ https://www.make.com/oauth/cb
```

### 間違い2: http と https
```
❌ http://www.make.com/oauth/cb
✅ https://www.make.com/oauth/cb
```

### 間違い3: www の有無
```
❌ https://make.com/oauth/cb          (wwwなし)
✅ https://www.make.com/oauth/cb      (wwwあり)
```

### 間違い4: ポート番号
```
❌ https://www.make.com:443/oauth/cb
✅ https://www.make.com/oauth/cb
```

### 間違い5: エンコード
```
❌ https://www.make.com/oauth%2Fcb     (エンコード済み)
✅ https://www.make.com/oauth/cb      (そのまま)
```

---

## 🔧 修正手順（Google Cloud Console）

### ステップ1: Clients設定を開く

1. Google Cloud Console → **APIとサービス** → **認証情報**
2. **OAuth 2.0 クライアント ID** の「Make.com Integration」をクリック
3. **「承認済みのリダイレクトURI」** セクションを確認

### ステップ2: リダイレクトURIを追加/修正

1. **「URIを追加」** をクリック
2. 以下の3つを**1つずつ**追加：

```
https://www.make.com/oauth/cb
```
→ **保存**

```
https://us2.make.com/oauth/cb
```
→ **保存**

```
https://eu1.make.com/oauth/cb
```
→ **保存**

### ステップ3: 既存のURIを確認

既に登録されているURIで、以下に該当するものは**削除**してください：

- 末尾に `/` があるもの
- `http://` で始まるもの
- 間違ったサブドメインのもの

---

## 🔍 Authorized domains（承認済みドメイン）の確認

**Verification Center → Authorized domains** で以下を追加：

```
make.com
www.make.com
us2.make.com
eu1.make.com
```

**⚠️ 注意**: 
- `https://` は不要
- `/oauth/cb` は不要
- ドメインのみ（例: `make.com`）

---

## 🧪 動作確認

### テスト手順

1. **Google Cloud Consoleで設定を保存**
2. **数秒待つ**（設定が反映されるまで）
3. **Make.comで接続をテスト**
   - Firestoreモジュール → 「Add a new connection」
   - 「Sign in with Google」をクリック
   - 認証が成功するか確認

---

## ✅ チェックリスト

- [ ] Google Cloud ConsoleでClients設定を開いた
- [ ] 3つのリダイレクトURIを追加した
  - [ ] `https://www.make.com/oauth/cb`
  - [ ] `https://us2.make.com/oauth/cb`
  - [ ] `https://eu1.make.com/oauth/cb`
- [ ] 末尾スラッシュがないことを確認
- [ ] `https://` で始まることを確認
- [ ] Authorized domainsを設定した（Externalの場合）
- [ ] Make.comで接続テストを実行
- [ ] エラーが解消された

---

**最終更新**: 2025-01-XX  
**作成者**: AI Assistant (Auto)

