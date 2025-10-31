# 動作確認ガイド

## 開発サーバーの起動

```bash
npm run dev
```

開発サーバーは `http://localhost:3000` で起動します。

## 動作確認チェックリスト

### 1. ブラウザでの基本確認

1. ブラウザで `http://localhost:3000` にアクセス
2. コンソール（F12 → Console）を開く
3. 以下のメッセージが表示されるか確認：
   - `DOM loaded`
   - `環境変数読み込み状況: { liffId: '✓', firebase: '✓', ... }`

### 2. LIFFアプリの動作確認

**注意**: LIFFアプリはLINEアプリ内でのみ完全に動作します。ブラウザでは以下の制限があります：

- ✅ **ローカル開発**: `localhost`で開発サーバーを起動
- ✅ **LINEアプリ**: LINEアプリのリッチメニューからLIFF URLにアクセス
- ❌ **ブラウザ直接アクセス**: LIFF初期化は失敗します（想定動作）

### 3. LINEアプリでの確認手順

1. LINE Developers Consoleで、LIFFアプリのエンドポイントURLを以下に設定：
   ```
   http://localhost:3000
   ```
   または、Netlifyでデプロイした場合：
   ```
   https://your-site.netlify.app
   ```

2. LINEアプリで、該当チャネルのリッチメニューをタップ
3. LIFFアプリが開き、以下が表示されることを確認：
   - ✅ 「NEW WORLD」タイトル
   - ✅ 「AIKAバトルスカウター プロジェクト」サブタイトル
   - ✅ 「🚀 デプロイ成功」メッセージ
   - ✅ ユーザー名（LIFF初期化成功時）
   - ✅ 環境変数読み込み状況（開発環境のみ）

### 4. エラーチェック

#### ブラウザでアクセスした場合
- **想定エラー**: `LIFF initialization failed`
- **理由**: LIFFはLINEアプリ内でのみ動作します
- **対処**: LINEアプリからアクセスしてください

#### LINEアプリでアクセスした場合にエラーが出る場合

**エラー**: `LIFF ID is required`
- **原因**: `.env.local`ファイルに`VITE_LIFF_ID`が設定されていない
- **対処**: `.env.local`ファイルを確認し、LIFF IDを設定

**エラー**: `invalid_client_id`
- **原因**: LIFF IDが間違っている、またはLIFFアプリが削除されている
- **対処**: LINE Developers ConsoleでLIFF IDを確認

### 5. コンソールログの確認

正常な場合のコンソール出力例：

```
DOM loaded
環境変数読み込み状況: { liffId: '✓', firebase: '✓', imagekit: '✓', googleSheet: '✓', gcs: '✓' }
LIFF initialized successfully { displayName: 'ユーザー名', userId: '...', ... }
App initialized for user: ユーザー名
```

### 6. 環境変数の確認

`.env.local`ファイルが正しく読み込まれているか確認：

```bash
# 開発サーバー起動時に、コンソールに以下が表示されるはずです：
環境変数読み込み状況: {
  liffId: '✓',      # VITE_LIFF_ID
  firebase: '✓',    # VITE_FIREBASE_API_KEY
  imagekit: '✓',    # VITE_IMAGEKIT_PUBLIC_KEY
  googleSheet: '✓', # VITE_GOOGLE_SHEET_ID
  gcs: '✓'          # VITE_GCS_BUCKET_NAME
}
```

## 次のステップ

動作確認が完了したら：

1. ✅ LIFF初期化が成功
2. ✅ ユーザー情報が取得できる
3. → **次の実装**: Firebase SDK初期化と動画アップロード機能

