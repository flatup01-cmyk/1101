# 🚨 OAuth redirect_uri_mismatch エラー 即座解決方法

## ❌ 現在のエラー

```
Access blocked: AIKA's request is invalid
Error 400: redirect_uri_mismatch
```

---

## 🔍 ステップ1: 実際に送信されているURIを確認（最重要）

### 方法A: エラーメッセージの「error details」から確認（推奨）

1. **エラーメッセージの「error details」または「Learn more about this error」をクリック**
2. **実際に送信されているURIを確認**

エラーメッセージには、以下のような情報が含まれているはずです：
```
The redirect URI in the request: https://www.make.com/oauth/cb
does not match the ones authorized for the OAuth client.
```

**この `https://www.make.com/oauth/cb` の部分が、Make.comが実際に使用しているURIです。**

**よくあるパターン**:
```
redirect_uri=https://www.make.com/oauth/cb
redirect_uri=https://us2.make.com/oauth/cb
```

### 方法B: ブラウザの開発者ツールで確認

1. **F12で開発者ツールを開く**
2. **Networkタブを選択**
3. **Make.comで「Sign in with Google」をクリック**
4. **OAuth認証のリクエストを見つける**
5. **`redirect_uri` パラメータを確認**

---

## ✅ ステップ2: Google Cloud Consoleで正確なURIを追加

1. **Google Cloud Consoleを開く**
   - https://console.cloud.google.com/apis/credentials?project=aikaapp-584fa

2. **OAuth 2.0 クライアント IDを開く**
   - 「Make.com Integration」をクリック

3. **「承認済みのリダイレクトURI」に以下を追加**

**まず、エラーメッセージから確認した実際のURIを追加**（最重要）

もしエラーメッセージにURIが表示されていない場合は、以下を**全て**追加：

```
https://www.make.com/oauth/cb
https://us2.make.com/oauth/cb
https://eu1.make.com/oauth/cb
```

**⚠️ 必須確認事項**:
- [ ] 末尾に `/` がない（`/oauth/cb` ← これが正しい）
- [ ] `https://` で始まる（`http://` ではない）
- [ ] スペースがない
- [ ] 完全一致

4. **「保存」をクリック**

5. **数秒待つ**（設定が反映されるまで）

---

## 🔄 ステップ3: Make.comで接続を再試行

1. **Make.comの接続設定画面に戻る**
2. **既存の接続を削除**（もしあれば）
3. **「Add a new connection」をクリック**
4. **「Sign in with Google」をクリック**
5. **認証が成功するか確認**

---

## 🆘 それでも解決しない場合

### トラブルシューティング手順

1. **Google Cloud Consoleの設定を再確認**
   - 実際に追加されているURIを目視確認
   - コピペミスがないか確認

2. **Make.comのリージョンを確認**
   - Make.comのダッシュボードで使用中のリージョンを確認
   - 該当するリダイレクトURIが追加されているか確認

3. **新しいOAuthクライアントを作成**
   - 既存のクライアントを削除（または無視）
   - 「+ CREATE CLIENT」で新規作成
   - リダイレクトURIを正確に設定
   - Make.comで新しいClient ID/Secretを使用

4. **ブラウザキャッシュをクリア**
   - `Cmd + Shift + R` (Mac) または `Ctrl + Shift + R` (Windows)
   - またはシークレットモードで試す

---

## 📝 今すぐやること（チェックリスト）

- [ ] Google Cloud Consoleのエラーメッセージで実際のURIを確認
- [ ] 確認したURIを「承認済みのリダイレクトURI」に追加（完全一致）
- [ ] 末尾スラッシュがないことを確認
- [ ] `https://` で始まることを確認
- [ ] 保存して数秒待つ
- [ ] Make.comで接続を再試行

---

**最終更新**: 2025-01-XX  
**作成者**: AI Assistant (Auto)

