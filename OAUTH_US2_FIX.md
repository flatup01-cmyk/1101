# 🔧 OAuth redirect_uri_mismatch エラー解決（us2.make.com対応版）

## ❌ エラー: 404 - リダイレクトURI不一致

Make.comが `us2.make.com` を使用しているため、該当URIを登録する必要があります。

---

## ✅ 即座解決手順

### ステップ1: Google Cloud ConsoleでリダイレクトURIを追加

1. **Google Cloud Consoleを開く**
   - https://console.cloud.google.com/apis/credentials?project=aikaapp-584fa

2. **OAuth 2.0 クライアント IDを開く**
   - 「Make.com Integration」をクリック
   - または、該当するクライアントを開く

3. **「承認済みのリダイレクトURI」に以下を追加**

**必須（us2.make.com）**:
```
https://us2.make.com/oauth/cb
```

**予備（メインリージョン）**:
```
https://www.make.com/oauth/cb
```

**⚠️ 完全一致の確認**:
- [ ] 末尾スラッシュ（`/`）がない
- [ ] `https://` で始まる（`http://` ではない）
- [ ] スペースがない
- [ ] そのままコピペ（余分な文字がない）

4. **「保存」をクリック**

---

### ステップ2: OAuth同意画面の設定確認

1. **左メニューから「Verification Center」を選択**

2. **Authorized domains（承認済みドメイン）に追加**
   ```
   make.com
   ```

   **⚠️ 注意**:
   - `https://` は不要
   - `/oauth/cb` は不要
   - ドメインのみ（`make.com`）

3. **「Publish App」をクリック**（未公開の場合）
   - Externalを選択している場合は公開が必要

---

### ステップ3: クライアント情報の確認

1. **OAuth 2.0 クライアント IDの画面で確認**

2. **Application type（アプリケーションタイプ）**
   ```
   Web application  ← これが正しい
   ```

3. **Client ID と Client Secret を確認**
   - 表示中のClient IDをメモ
   - 対応するClient Secretを確認

4. **Make.comで使用しているClient ID/Secretと一致しているか確認**

---

### ステップ4: Make.comで接続を再試行

1. **Make.comの接続設定画面に戻る**

2. **既存の接続を削除**（もしあれば）

3. **「Add a new connection」をクリック**

4. **「Sign in with Google」をクリック**

5. **認証が成功するか確認**

---

## 🆘 まだ404エラーが発生する場合

### 実際のURIを確認

1. **エラーメッセージの「error details」を開く**
   - 実際に送信されているURIを確認

2. **または、ブラウザの開発者ツール（F12）で確認**
   - Networkタブ → OAuth認証のリクエストを確認
   - `redirect_uri` パラメータを確認

3. **確認したURIをそのままコピー**
   - 表示されたURIをそのままGoogle Cloud Consoleに追加

**よくあるパターン**:
```
https://us2.make.com/oauth/cb
https://us2.make.com/oauth/v2/cb  ← パスが異なる場合
https://hook.us2.make.com/oauth/cb  ← 別のサブドメインの場合
```

---

## 📝 設定完了チェックリスト

- [ ] Google Cloud Consoleで `https://us2.make.com/oauth/cb` を追加
- [ ] Google Cloud Consoleで `https://www.make.com/oauth/cb` を追加（予備）
- [ ] 末尾スラッシュがないことを確認
- [ ] `https://` で始まることを確認
- [ ] OAuth同意画面で `make.com` をAuthorized domainsに追加
- [ ] OAuth同意画面を公開（Externalの場合）
- [ ] Application typeが「Web application」であることを確認
- [ ] Client ID / Client SecretがMake.comで使用しているものと一致
- [ ] 保存して数秒待つ
- [ ] Make.comで接続を再試行

---

## ✅ 成功の確認

接続が成功すると：
- ✅ Make.comの接続一覧に表示される
- ✅ エラーが消える
- ✅ Firestore監視 → Dify → LINE → notification_sent: true まで稼働

---

**最終更新**: 2025-01-XX  
**作成者**: AI Assistant (Auto)





