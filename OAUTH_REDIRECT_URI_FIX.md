# 🔧 OAuthリダイレクトURI修正ガイド

## ⚠️ 問題点と解決策

### 問題1: リダイレクトURIの不一致

**症状**: OAuth認証で「リダイレクトURI不一致」エラーが発生

**原因**: 
- https/http の違い
- 末尾スラッシュの有無
- サブドメインの差（make.com vs us2.make.com）
- ポート番号の有無
- URIのエンコードミス

---

## 📋 確認すべきリダイレクトURI

### Make.com側で実際に使用されるURI

Make.comは以下のリダイレクトURIを使用します：

#### パターン1: メインリージョン
```
https://www.make.com/oauth/cb
```

#### パターン2: USリージョン（us2）
```
https://us2.make.com/oauth/cb
```

#### パターン3: EUリージョン（eu1）
```
https://eu1.make.com/oauth/cb
```

**⚠️ 重要**: 
- 末尾に `/` は**不要**
- `https://` で始まる（`http://` ではない）
- 大文字小文字は正確に

---

### LIFFアプリ側のリダイレクトURI（もしOAuthが必要な場合）

現在のLIFFアプリはLINE認証を使用しているため、Google OAuthのリダイレクトURIは**Make.com連携のみ**で使用します。

---

## 🔧 Google Cloud Consoleでの設定

### ステップ1: 現在のリダイレクトURIを確認

1. **Google Cloud Consoleを開く**
   - https://console.cloud.google.com/
   - プロジェクト「aikaapp-584fa」を選択

2. **APIとサービス → 認証情報**
   - 左メニュー → 「APIとサービス」→ 「認証情報」

3. **OAuth 2.0 クライアント ID を確認**
   - 「Make.com Integration」のクライアントを開く
   - 「承認済みのリダイレクトURI」を確認

---

### ステップ2: リダイレクトURIを追加/修正

**必須のリダイレクトURI**（全て追加）:

```
https://www.make.com/oauth/cb
https://us2.make.com/oauth/cb
https://eu1.make.com/oauth/cb
```

**⚠️ 注意事項**:

1. **末尾スラッシュなし**
   ```
   ❌ https://www.make.com/oauth/cb/
   ✅ https://www.make.com/oauth/cb
   ```

2. **完全一致**
   ```
   ❌ https://make.com/oauth/cb          (wwwなし)
   ❌ http://www.make.com/oauth/cb        (http)
   ✅ https://www.make.com/oauth/cb       (完全一致)
   ```

3. **ポート番号なし**
   ```
   ❌ https://www.make.com:443/oauth/cb
   ✅ https://www.make.com/oauth/cb
   ```

4. **エンコード不要**
   ```
   ❌ https://www.make.com/oauth%2Fcb     (エンコード)
   ✅ https://www.make.com/oauth/cb       (そのまま)
   ```

---

### ステップ3: Authorized domains（承認済みドメイン）の設定

**Verification Center → Authorized domains** で以下を追加:

```
make.com
www.make.com
us2.make.com
eu1.make.com
```

**⚠️ 注意**: 
- `https://` や `/oauth/cb` は不要
- ドメインのみ（例: `make.com`）

---

## 🔍 環境差異の確認（本番/開発）

### 問題: 本番と開発の設定が混ざっている

**確認事項**:

1. **Client ID / Client Secretの確認**
   - 本番用と開発用を分けているか確認
   - Make.comに設定されているのはどちらか確認

2. **環境変数の確認**
   - 開発環境と本番環境で異なるClient IDを使用しているか

**推奨**: 
- **本番用**: Make.comで使用するクライアント
- **開発用**: テスト用のクライアント（別途作成）

---

## 📝 正しい設定のチェックリスト

### Google Cloud Console（Clients）

- [ ] **Application type**: `Web application`
- [ ] **Name**: `Make.com Integration`（または分かりやすい名前）
- [ ] **Authorized redirect URIs**: 以下を全て追加
  - [ ] `https://www.make.com/oauth/cb`
  - [ ] `https://us2.make.com/oauth/cb`
  - [ ] `https://eu1.make.com/oauth/cb`
- [ ] **末尾スラッシュなし**
- [ ] **https:// で始まる（http:// ではない）**
- [ ] **大文字小文字が正確**

### Verification Center（Externalの場合）

- [ ] **Authorized domains**: 以下を追加
  - [ ] `make.com`
  - [ ] `www.make.com`
  - [ ] `us2.make.com`
  - [ ] `eu1.make.com`
- [ ] **Publish App**: 公開済み（Externalの場合）

### Make.com側の接続

- [ ] **Client ID**: Google Cloud Consoleで生成したものを使用
- [ ] **Client Secret**: Google Cloud Consoleで生成したものを使用
- [ ] **「Sign in with Google」**: 正常に完了
- [ ] **接続一覧に表示**: エラーなし

---

## 🧪 テスト方法

### ステップ1: Google Cloud Consoleで設定を確認

1. **Clients設定を開く**
2. **「承認済みのリダイレクトURI」を確認**
3. 上記3つのURIが全て追加されているか確認

### ステップ2: Make.comで接続をテスト

1. **Make.comでFirestoreモジュールを追加**
2. **「Add a new connection」をクリック**
3. **「Sign in with Google」をクリック**
4. **認証が成功するか確認**

**成功の場合**:
- ✅ OAuth認証画面が表示される
- ✅ 権限を許可できる
- ✅ 接続一覧に表示される

**失敗の場合（リダイレクトURI不一致）**:
- ❌ エラーメッセージ: "redirect_uri_mismatch"
- ❌ リダイレクトURIが一致していない

---

## 🔍 エンコードミスの確認

### 問題: URIが途中で変形・エンコードされている

**確認方法**:

1. **Make.comの接続設定を確認**
   - Client ID / Client Secretに余分な文字がないか
   - URLエンコードされていないか

2. **ブラウザの開発者ツールで確認**
   - F12 → Networkタブ
   - OAuth認証のリクエストを確認
   - `redirect_uri` パラメータが正しいか確認

**正しい例**:
```
redirect_uri=https://www.make.com/oauth/cb
```

**間違った例**:
```
redirect_uri=https%3A%2F%2Fwww.make.com%2Foauth%2Fcb  (エンコード済み)
redirect_uri=https://www.make.com/oauth/cb/            (末尾スラッシュ)
redirect_uri=http://www.make.com/oauth/cb              (http)
```

---

## ✅ 最終確認

全ての設定が完了したら、以下を確認してください：

1. **Google Cloud Console**
   - [ ] 3つのリダイレクトURIが追加されている
   - [ ] Authorized domainsが設定されている（Externalの場合）
   - [ ] Client ID / Client Secretを安全に保存している

2. **Make.com**
   - [ ] 「Sign in with Google」が正常に完了
   - [ ] 接続一覧に表示されている
   - [ ] エラーがない

3. **テスト実行**
   - [ ] Firestoreトリガーが動作する
   - [ ] OAuth認証エラーがない

---

## 🆘 まだエラーが発生する場合

### トラブルシューティング

1. **リダイレクトURIを再確認**
   - Google Cloud Consoleで設定を再確認
   - Make.comの接続を削除して再作成

2. **ブラウザキャッシュをクリア**
   - 認証画面がキャッシュされている可能性

3. **Make.comのリージョンを確認**
   - 使用しているリージョン（us2, eu1等）を確認
   - 該当するリダイレクトURIが設定されているか確認

4. **Client ID / Client Secretを再生成**
   - 新しいクライアントを作成
   - Make.comで新しい認証情報を使用

---

**最終更新**: 2025-01-XX  
**作成者**: AI Assistant (Auto)

