# 🚀 Make.com × Google認証 即座解決ガイド

## ❌ 現在の問題

Make.comとGoogleの認証が取れず、ずっとエラーが続いている。

---

## ✅ 解決手順（10分で完了）

### ステップ1: Google Cloud Consoleで設定を確認（3分）

1. **Google Cloud Consoleを開く**
   ```
   https://console.cloud.google.com/apis/credentials?project=aikaapp-584fa
   ```

2. **OAuth 2.0 クライアント IDを開く**
   - 「Make.com Integration」をクリック
   - または、該当するOAuthクライアントを開く

3. **「承認済みのリダイレクトURI」を確認・追加**

   **必須（3つ全て）**:
   ```
   https://www.make.com/oauth/cb
   https://us2.make.com/oauth/cb
   https://eu1.make.com/oauth/cb
   ```

   **⚠️ 重要な確認ポイント**:
   - [ ] 末尾に `/` がない（`/oauth/cb` ← これが正しい）
   - [ ] `https://` で始まる（`http://` ではない）
   - [ ] スペースがない
   - [ ] 3つ全てが登録されている

4. **Application typeを確認**
   ```
   Web application  ← これが正しい
   ```

5. **Client ID と Client Secretをコピー**
   - 画面に表示されているClient IDをメモ
   - Client Secretが表示されていない場合は「RESET」で再生成

---

### ステップ2: OAuth同意画面を確認（2分）

1. **左メニューから「Verification Center」を選択**

2. **Authorized domains（承認済みドメイン）を確認**
   ```
   make.com
   ```
   - `https://` は不要
   - `/oauth/cb` は不要
   - ドメインのみ（`make.com`）

3. **公開状態を確認**
   - Externalを選択している場合 → 「Publish App」で公開されているか確認
   - Internalの場合 → 公開は不要

---

### ステップ3: Make.comで接続を削除して再作成（3分）

1. **Make.comで既存の接続を削除**
   - Connections → Google Cloud Firestore → 該当する接続を削除

2. **ブラウザを完全にリフレッシュ**
   - Mac: `Cmd + Shift + R`
   - Windows: `Ctrl + Shift + R`
   - キャッシュをクリア

3. **シークレットモードで試す（推奨）**
   - 新しいシークレットウィンドウを開く
   - Make.comにログイン
   - 新しい接続を作成

4. **新しい接続を作成**
   - Make.comでFirestoreモジュールを追加
   - 「Add a new connection」をクリック
   - 「Sign in with Google」をクリック
   - Client ID / Client Secretを入力（OAuth方式の場合）

---

### ステップ4: 待機（重要！）

**⚠️ 重要**: Google Cloudで設定を変更すると、反映まで**5分〜1時間**かかることがあります。

1. **Make.comのタブを閉じる**
2. **30分〜1時間待つ**
3. **時間が経過したら再試行**

---

## 🔧 それでも解決しない場合：サービスアカウントキー方式に切り替え

OAuth方式でどうしても解決しない場合は、**サービスアカウントキー（JSONファイル）**方式に切り替えます。

### サービスアカウントキー方式の手順

#### 1. サービスアカウントを作成

1. **Google Cloud Consoleを開く**
   ```
   https://console.cloud.google.com/iam-admin/serviceaccounts?project=aikaapp-584fa
   ```

2. **「+ CREATE SERVICE ACCOUNT」をクリック**

3. **サービスアカウント情報を入力**
   - **Service account name**: `make-com-firestore`
   - **Service account ID**: 自動生成（そのまま）
   - **Description**: `Make.com Firestore integration`
   - 「CREATE AND CONTINUE」をクリック

4. **ロールを付与**
   - **Role**: `Cloud Datastore User` を選択
   - 「CONTINUE」→「DONE」をクリック

#### 2. サービスアカウントキーを生成

1. **作成したサービスアカウントをクリック**
   - `make-com-firestore@aikaapp-584fa.iam.gserviceaccount.com`

2. **「KEYS」タブを選択**

3. **「ADD KEY」→「Create new key」をクリック**

4. **キータイプを選択**
   ```
   JSON
   ```

5. **「CREATE」をクリック**
   - JSONファイルが自動的にダウンロードされます
   - **このファイルを安全に保管**してください

#### 3. Make.comでサービスアカウントキーを使用

1. **Make.comで新しいシナリオを作成**

2. **Cloud Firestoreモジュールを追加**

3. **接続タイプを選択**
   - 「Service Account Key」を選択（OAuthではなく）

4. **JSONファイルの内容を貼り付け**
   - ダウンロードしたJSONファイルをテキストエディタで開く
   - 内容を全てコピー
   - Make.comの接続設定画面の「Service Account Key」フィールドに貼り付け

5. **「Save」をクリック**
   - 接続が作成されます

---

## 📊 チェックリスト

### OAuth方式の場合

- [ ] Google Cloud ConsoleでリダイレクトURIが3つ全て登録されている
  - [ ] `https://www.make.com/oauth/cb`
  - [ ] `https://us2.make.com/oauth/cb`
  - [ ] `https://eu1.make.com/oauth/cb`
- [ ] Application typeが「Web application」である
- [ ] Client ID / Client Secretが正しい
- [ ] Authorized domainsに `make.com` が追加されている
- [ ] OAuth同意画面が公開されている（Externalの場合）
- [ ] Make.comで接続を削除して再作成した
- [ ] 30分〜1時間待った
- [ ] シークレットモードで試した

### サービスアカウントキー方式の場合

- [ ] サービスアカウントを作成した
- [ ] 適切なロール（Cloud Datastore User）を付与した
- [ ] JSONキーファイルをダウンロードした
- [ ] Make.comでサービスアカウントキー方式を選択した
- [ ] JSONファイルの内容を正しく貼り付けた

---

## ✅ 成功の確認

接続が成功すると：
- ✅ Make.comの接続一覧に「Google Cloud Firestore」が表示される
- ✅ エラーが消える
- ✅ Firestoreトリガー（Watch Documents）が正常に動作する

---

## 🆘 トラブルシューティング

### 問題1: loading...のまま進まない

**原因**: Googleのサーバーに設定が反映されるまでの時間

**解決方法**:
1. 30分〜1時間待つ
2. ブラウザを完全にリフレッシュ
3. シークレットモードで試す
4. それでもダメならサービスアカウントキー方式に切り替え

---

### 問題2: "redirect_uri_mismatch"エラー

**原因**: リダイレクトURIが登録されていない、または形式が間違っている

**解決方法**:
1. Google Cloud ConsoleでリダイレクトURIを確認
2. 以下の3つを**完全一致**で追加（末尾スラッシュなし）:
   ```
   https://www.make.com/oauth/cb
   https://us2.make.com/oauth/cb
   https://eu1.make.com/oauth/cb
   ```
3. 保存して30分〜1時間待つ
4. Make.comで接続を再作成

---

### 問題3: "Access denied"エラー

**原因**: Authorized domainsに `make.com` が追加されていない

**解決方法**:
1. Google Cloud Console → Verification Center
2. Authorized domains に `make.com` を追加（`https://` は不要）
3. 保存して30分〜1時間待つ

---

### 問題4: どの方法でも解決しない

**最終手段**: サービスアカウントキー方式を試してください。OAuth方式より確実に動作します。

---

## 💡 推奨事項

### 最初に試すべき方法: OAuth方式

OAuth方式の方が安全で管理しやすいため、まずはOAuth方式を試してください。

ただし、loading...が続く場合は、**戦略的待機（30分〜1時間）**が重要です。

### 最終手段: サービスアカウントキー方式

OAuth方式でどうしても解決しない場合のみ、サービスアカウントキー方式に切り替えてください。

---

**最終更新**: 2025-11-03

