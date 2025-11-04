# 🚨 redirect_uri_mismatch エラー 即座解決ガイド

## ❌ 現在のエラー

```
Error 400: redirect_uri_mismatch
Access blocked: AIKA's request is invalid
```

---

## 🔍 ステップ1: 実際に送信されているURIを確認（最重要）

### 方法A: Google Cloud Consoleのエラーディテールから確認

1. **エラーメッセージの「error details」または「Learn more about this error」をクリック**
2. **実際に送信されているURIを確認**

エラーメッセージには、以下のような情報が含まれているはずです：
```
The redirect URI in the request: https://...
does not match the ones authorized for the OAuth client.
```

この `https://...` の部分が、Make.comが実際に使用しているURIです。

---

### 方法B: ブラウザの開発者ツールで確認

1. **F12で開発者ツールを開く**
2. **Networkタブを選択**
3. **Make.comで「Sign in with Google」をクリック**
4. **OAuth認証のリクエストを見つける**（通常、`accounts.google.com` へのリクエスト）
5. **リクエストの詳細を確認**
   - Headersタブ → Query String Parameters を確認
   - または、Request URL を確認

**確認すべきパラメータ**:
```
redirect_uri=https://www.make.com/oauth/cb
```
または
```
redirect_uri=https://us2.make.com/oauth/cb
```

---

## ✅ ステップ2: Google Cloud Consoleで正確なURIを追加

### 手順

1. **Google Cloud Consoleを開く**
   - https://console.cloud.google.com/apis/credentials?project=aikaapp-584fa

2. **OAuth 2.0 クライアント IDを開く**
   - 「Make.com Integration」をクリック

3. **「承認済みのリダイレクトURI」セクションを確認**

4. **エラーメッセージで確認した実際のURIを追加**

**まず、エラーメッセージに表示された実際のURIを追加**（これが最重要です）

もしエラーメッセージにURIが表示されていない場合は、以下を**全て**追加してください：

```
https://www.make.com/oauth/cb
https://us2.make.com/oauth/cb
https://eu1.make.com/oauth/cb
```

---

## ⚠️ 完全一致のチェックポイント

追加する際、以下を**必ず確認**してください：

- [ ] **末尾スラッシュなし**: `https://www.make.com/oauth/cb` ✅（`/oauth/cb/` ❌）
- [ ] **https://で始まる**: `https://` ✅（`http://` ❌）
- [ ] **スペースなし**: URIにスペースやタブがない
- [ ] **完全一致**: エラーメッセージに表示されたURIと完全に同じ

---

## 🔧 ステップ3: 設定を保存して反映を待つ

1. **「保存」または「UPDATE」ボタンをクリック**
2. **数秒待つ**（設定が反映されるまで、通常5-10秒）

---

## 🔄 ステップ4: Make.comで接続を再試行

1. **Make.comの接続設定画面に戻る**
2. **既存の接続を削除**（もしあれば、「Delete」または「削除」をクリック）
3. **「Add a new connection」をクリック**
4. **「Sign in with Google」をクリック**
5. **認証が成功するか確認**

---

## 🆘 それでも解決しない場合

### トラブルシューティング手順

#### 1. 実際のURIを再度確認

エラーメッセージの「error details」を開き、実際に送信されているURIを**正確にコピー**してください。

**よくあるパターン**:
- `https://www.make.com/oauth/cb`
- `https://us2.make.com/oauth/cb`
- `https://eu1.make.com/oauth/cb`
- `https://eu1.make.com/oauth/v2/cb`（パスが異なる場合）
- `https://hook.us1.make.com/oauth/cb`（別のサブドメインの場合）

#### 2. Google Cloud Consoleの設定を再確認

追加したURIが以下を満たしているか確認：

- [ ] 完全一致で登録されている（スペースなし）
- [ ] 末尾スラッシュがない
- [ ] `https://` で始まる
- [ ] エラーメッセージのURIと完全に同じ

#### 3. 新しいOAuthクライアントを作成

既存のクライアントで問題が解決しない場合：

1. **新しいOAuthクライアントを作成**
   - 「+ CREATE CLIENT」をクリック
   - Application type: `Web application`
   - Name: `Make.com Integration v2`

2. **リダイレクトURIを正確に設定**
   - エラーメッセージで確認した実際のURIを追加

3. **新しいClient ID / Client Secretを使用**
   - Make.comで新しい認証情報を使用

#### 4. Make.comのリージョンを確認

Make.comのダッシュボードで、使用しているリージョン（us2, eu1等）を確認し、該当するURIが設定されているか確認してください。

---

## 📝 今すぐやること（簡易チェックリスト）

1. [ ] **エラーメッセージの「error details」を開く**
2. [ ] **実際に送信されているURIを確認・コピー**
3. [ ] **Google Cloud ConsoleでそのURIを追加**（完全一致）
4. [ ] **保存して数秒待つ**
5. [ ] **Make.comで接続を再試行**

---

## 💡 ヒント

エラーメッセージに表示されているURIを**そのままコピー**して、Google Cloud Consoleに貼り付けるのが最も確実です。

もしエラーメッセージにURIが表示されていない場合は、ブラウザの開発者ツール（F12）で確認してください。

---

**最終更新**: 2025-01-XX  
**作成者**: AI Assistant (Auto)




