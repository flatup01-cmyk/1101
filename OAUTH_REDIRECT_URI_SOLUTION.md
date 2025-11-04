# 🔧 OAuth redirect_uri_mismatch エラー解決方法

## ❌ エラー: "Error 400: redirect_uri_mismatch"

**症状**: Make.comで「Sign in with Google」を実行すると、以下のエラーが表示される
```
Access blocked: AIKA's request is invalid
Error 400: redirect_uri_mismatch
```

---

## 🔍 原因

Make.comが実際に送信しているリダイレクトURIが、Google Cloud Consoleに登録されているURIと**完全一致していない**ため。

---

## ✅ 解決方法

### ステップ1: Make.comが実際に使用しているURIを確認

Make.comの接続設定画面で、実際に使用されているリダイレクトURIを確認する必要があります。

**確認方法**:
1. Make.comでFirestoreモジュールを開く
2. 「Add a new connection」をクリック
3. 「Sign in with Google」をクリック
4. エラーメッセージまたはブラウザの開発者ツール（F12）で、実際に送信されているURIを確認

**よくあるパターン**:
```
https://www.make.com/oauth/cb
https://us2.make.com/oauth/cb
https://eu1.make.com/oauth/cb
```

---

### ステップ2: Google Cloud Consoleで正確なURIを追加

1. **Google Cloud Consoleを開く**
   - https://console.cloud.google.com/
   - プロジェクト「aikaapp-584fa」を選択

2. **APIとサービス → 認証情報**
   - 左メニュー → 「APIとサービス」→ 「認証情報」

3. **OAuth 2.0 クライアント IDを開く**
   - 「Make.com Integration」のクライアントをクリック

4. **「承認済みのリダイレクトURI」に追加**

**⚠️ 重要**: Make.comが実際に使用しているURIを**完全一致**で追加

以下の3つを全て追加（Make.comのリージョンによって異なる場合があります）:

```
https://www.make.com/oauth/cb
https://us2.make.com/oauth/cb
https://eu1.make.com/oauth/cb
```

**注意事項**:
- ❌ `https://www.make.com/oauth/cb/` （末尾スラッシュなし）
- ❌ `http://www.make.com/oauth/cb` （httpsを使用）
- ❌ `https://make.com/oauth/cb` （wwwが必要）
- ✅ `https://www.make.com/oauth/cb` （完全一致）

5. **「保存」をクリック**

---

### ステップ3: Make.comで接続を再試行

1. **数秒待つ**（Google Cloud Consoleの設定が反映されるまで）
2. **Make.comの接続設定画面に戻る**
3. **「Sign in with Google」を再度クリック**
4. **認証が成功するか確認**

---

## 🔍 詳細確認方法

### ブラウザの開発者ツールで確認

1. **F12で開発者ツールを開く**
2. **Networkタブを選択**
3. **Make.comで「Sign in with Google」をクリック**
4. **ネットワークリクエストを確認**
   - OAuth認証のリクエストを見つける
   - `redirect_uri` パラメータを確認

**確認すべき情報**:
```
redirect_uri=https://www.make.com/oauth/cb
```

このURIが、Google Cloud Consoleに登録されているURIと**完全一致**している必要があります。

---

## 🆘 それでも解決しない場合

### トラブルシューティング

1. **Google Cloud Consoleの設定を再確認**
   - リダイレクトURIが正確に登録されているか
   - スペースや余分な文字がないか

2. **Make.comの接続を完全に削除して再作成**
   - 既存の接続を削除
   - 新しい接続を作成
   - 「Sign in with Google」を再度実行

3. **ブラウザキャッシュをクリア**
   - OAuth認証画面がキャッシュされている可能性

4. **Make.comのリージョンを確認**
   - あなたが使用しているMake.comのリージョン（us2, eu1等）を確認
   - 該当するリダイレクトURIがGoogle Cloud Consoleに登録されているか確認

5. **新しいOAuthクライアントを作成**
   - 既存のクライアントを削除（または無視）
   - 新しいOAuthクライアントを作成
   - リダイレクトURIを正確に設定
   - Make.comで新しいClient ID/Secretを使用

---

## 📝 チェックリスト

- [ ] Make.comが実際に使用しているURIを確認した
- [ ] Google Cloud Consoleに完全一致のURIを追加した
- [ ] 末尾スラッシュがないことを確認した
- [ ] `https://` で始まることを確認した
- [ ] 3つのリージョン全て（www, us2, eu1）を追加した
- [ ] Make.comで接続を再試行した
- [ ] 認証が成功した

---

**最終更新**: 2025-01-XX  
**作成者**: AI Assistant (Auto)





