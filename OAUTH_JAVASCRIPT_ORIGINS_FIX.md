# 🔧 OAuth設定：JavaScript Origins vs Redirect URIs

## ⚠️ 重要な違い

Google Cloud ConsoleのOAuth設定には**2つの異なるフィールド**があります：

1. **Authorized JavaScript origins**（JavaScriptオリジン）
2. **Authorized redirect URIs**（リダイレクトURI）

**Make.com連携では、主に「Authorized redirect URIs」のみが必要です。**

---

## 📋 正しい設定方法

### Authorized JavaScript origins（JavaScriptオリジン）

**⚠️ 重要**: パスは含めません。ドメインのみです。

**設定値**:
```
https://www.make.com
https://us2.make.com
https://eu1.make.com
```

**❌ 間違い**:
```
https://www.make.com/oauth/cb  ← パスが含まれている（エラー）
https://www.make.com/         ← 末尾スラッシュがある（エラー）
```

**✅ 正しい**:
```
https://www.make.com           ← ドメインのみ
```

**注意**: 
- 末尾スラッシュ（`/`）は不要
- パス（`/oauth/cb`）は含めない
- プロトコル（`https://`）は必要

---

### Authorized redirect URIs（リダイレクトURI）

**⚠️ 重要**: 完全なパスを含みます。

**設定値**:
```
https://www.make.com/oauth/cb
https://us2.make.com/oauth/cb
https://eu1.make.com/oauth/cb
```

**❌ 間違い**:
```
https://www.make.com/oauth/cb/  ← 末尾スラッシュ（エラー）
http://www.make.com/oauth/cb    ← http（httpsが必要）
```

**✅ 正しい**:
```
https://www.make.com/oauth/cb   ← 完全なパス
```

---

## 🔧 Make.com連携での推奨設定

### ステップ1: Authorized JavaScript origins（オプション）

**通常は空欄のままでも動作しますが、もしエラーが出る場合は追加**:

```
https://www.make.com
https://us2.make.com
https://eu1.make.com
```

**設定方法**:
1. 「Authorized JavaScript origins」セクションを開く
2. 「+ ADD URI」をクリック
3. 上記3つを**1つずつ**追加（パスなし、スラッシュなし）

---

### ステップ2: Authorized redirect URIs（必須）

**以下の3つを完全一致で追加**:

```
https://www.make.com/oauth/cb
https://us2.make.com/oauth/cb
https://eu1.make.com/oauth/cb
```

**設定方法**:
1. 「Authorized redirect URIs」セクションを開く
2. 「+ ADD URI」をクリック
3. 上記3つを**1つずつ**追加（完全一致）

---

## ⚠️ よくあるエラーと解決方法

### エラー1: "cannot contain whitespace"

**原因**: URIにスペースやタブが含まれている

**解決方法**:
- URIをコピペする際、余分なスペースがないか確認
- 手動で入力する場合は、スペースを入れない

---

### エラー2: "URIs must not contain a path or end with '/'"

**原因**: Authorized JavaScript origins にパスが含まれている

**解決方法**:
- JavaScript origins には**ドメインのみ**を設定
- `/oauth/cb` などのパスは含めない
- 末尾スラッシュも含めない

**正しい例**:
```
✅ https://www.make.com
❌ https://www.make.com/oauth/cb  ← パスが含まれている
❌ https://www.make.com/          ← 末尾スラッシュ
```

---

### エラー3: "URI must not be empty"

**原因**: 空のURIが設定されている

**解決方法**:
- 空のURIを削除
- 正しいURIのみを設定

---

## 📝 設定のチェックリスト

### Authorized JavaScript origins（オプション）

- [ ] 3つのドメインを追加（パスなし）
  - [ ] `https://www.make.com`
  - [ ] `https://us2.make.com`
  - [ ] `https://eu1.make.com`
- [ ] 末尾スラッシュがない
- [ ] パスが含まれていない
- [ ] スペースがない

### Authorized redirect URIs（必須）

- [ ] 3つの完全なURIを追加（パス含む）
  - [ ] `https://www.make.com/oauth/cb`
  - [ ] `https://us2.make.com/oauth/cb`
  - [ ] `https://eu1.make.com/oauth/cb`
- [ ] 末尾スラッシュがない
- [ ] `https://` で始まる
- [ ] 完全一致

---

## ✅ 設定完了後の確認

1. **保存をクリック**
2. **数秒待つ**（設定が反映されるまで）
3. **Make.comで接続を再試行**
   - 「Sign in with Google」をクリック
   - 認証が成功するか確認

---

## 🆘 まだエラーが発生する場合

1. **ブラウザキャッシュをクリア**
2. **Make.comの接続を完全に削除して再作成**
3. **Google Cloud Consoleの設定を再確認**
   - JavaScript origins と redirect URIs が正しく設定されているか
   - スペースや余分な文字がないか

---

**最終更新**: 2025-01-XX  
**作成者**: AI Assistant (Auto)



