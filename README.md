# AIKA Battle Scouter

LINE LIFFアプリケーション - キックボクシング動画解析システム

## プロジェクト構成

```
1101 new/
├── フロントエンド（Vite/Node.js）
│   ├── src/
│   │   ├── main.js          # LIFFアプリのメインロジック
│   │   ├── config.js        # 設定ファイル（LIFF ID、Firebase等）
│   │   └── style.css        # スタイルシート
│   ├── index.html           # エントリーポイント
│   └── package.json         # Node.js依存関係
│
└── バックエンド（Python）
    └── analyze_video.py      # MediaPipe動画解析スクリプト
```

## 開発環境セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env`ファイルを作成し、以下の情報を設定してください：

```env
# LINE LIFF設定
VITE_LIFF_ID=your_liff_id_here

# Firebase設定（動画アップロード用）
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### 3. 開発サーバーの起動

```bash
npm run dev
```

### 4. ビルド

```bash
npm run build
```

## 必要な情報の取得方法

### LINE LIFF ID

1. [LINE Developers Console](https://developers.line.biz/console/) にログイン
2. 対象のプロバイダーとチャネルを選択
3. 「LIFF」タブを開く
4. 既存のLIFFアプリを選択するか、新規作成
5. 「LIFF ID」をコピーして`.env`の`VITE_LIFF_ID`に設定

### Firebase設定

1. [Firebase Console](https://console.firebase.google.com/) にログイン
2. プロジェクトを選択
3. ⚙️（設定） → プロジェクトの設定
4. 「マイアプリ」セクションの設定オブジェクトをコピー
5. 各値を`.env`ファイルに設定

## 開発の流れ

1. **Phase 0**: ローカル環境での動画解析開発（Python）
2. **Phase 1**: LIFFアプリのUI実装（現在）
3. **Phase 2**: Firebase Storageへの動画アップロード実装
4. **Phase 3**: Cloud Functionsとの統合
5. **Phase 4**: Dify API連携とAIKAレスポンス生成

## デプロイ

### Netlify

```bash
# ビルド
npm run build

# Netlifyで自動デプロイ
# リポジトリをNetlifyに接続すると、自動でビルド・デプロイされます
```

Netlify設定：
- Build command: `npm run build`
- Publish directory: `dist`

## ライセンス

MIT

