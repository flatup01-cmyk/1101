# 🔧 システムデバッグ・修復チェックリスト

30年以上の経験を持つエンジニアが国外大手企業で行うレベルの厳密なデバッグ観点を網羅。

## 1. 前提の確立と環境の完全再現

### 1a. 対象ブランチとコミットを固定
- [ ] 現在の `main` HEAD を記録: `git rev-parse HEAD`
- [ ] 作業用ブランチ作成: `git checkout -b fix/diagnostics-$(date +%Y%m%d-%H%M%S)`
- [ ] すべての操作はこのブランチで実行

### 1b. ローカル環境同期
- [ ] Python バージョンを確認: `python3 --version` (3.12推奨)
- [ ] Node.js バージョンを確認: `node --version` (20.x以上)
- [ ] Firebase CLI バージョン確認: `firebase --version`

### 1c. 依存のクリーン導入
- [ ] `functions/` ディレクトリで `rm -rf node_modules package-lock.json`
- [ ] `npm install` を実行
- [ ] Python依存: `pip install -r requirements.txt` (仮想環境推奨)

## 2. 設定・構成の静的検査

### 2a. 環境変数の整合性
- [ ] Firebase Functions の環境変数確認:
  - `DIFY_API_KEY` (Secret Manager latest)
  - `DIFY_API_URL` または `DIFY_API_ENDPOINT`
  - `DIFY_APP_ID` (オプション)
  - `LINE_CHANNEL_ACCESS_TOKEN` (Secret Manager latest)
  - `PROCESS_VIDEO_JOB_URL`
- [ ] Secret Manager のバージョン確認:
  - `DIFY_API_KEY` が `latest` を参照しているか
  - 値に改行・空白・非ASCII文字が混入していないか
- [ ] 環境変数の読み込みテスト:
  ```python
  import os
  print(f"DIFY_API_KEY exists: {bool(os.environ.get('DIFY_API_KEY'))}")
  ```

### 2b. 構成ファイルの整合性
- [ ] `functions/package.json` の依存関係確認
- [ ] `functions/requirements.txt` の依存関係確認
- [ ] `firebase.json` の設定確認（functions設定）

### 2c. パス・エイリアスの確認
- [ ] `functions/index.js` の import パスが正しいか
- [ ] `functions/main.py` の import パスが正しいか

## 3. コード面の重大リスク・不整合検査

### 3a. 認証・鍵取り扱い
- [ ] サービスアカウントJSONをコードやログに出していないか
- [ ] `console.log(process.env.DIFY_API_KEY)` 等の痕跡を除去
- [ ] Secret Manager のアクセスが適切か（`latest` バージョン使用）

### 3b. エラーハンドリング
- [ ] すべての `try/except` ブロックで適切なログ出力
- [ ] ユーザーへのエラーメッセージが適切か
- [ ] フォールバック処理が実装されているか

### 3c. 型定義・ビルドの健全性
- [ ] Python: `python -m py_compile functions/main.py` で構文エラー確認
- [ ] Node.js: `npm run build` または `node --check functions/index.js`

### 3d. 非推奨APIの排除
- [ ] `requests.post` の直接使用を避け、`urllib3` または `requests.Session` を使用
- [ ] ヘッダーがASCII文字のみか確認

## 4. 実行時検査（機能ごとの確証）

### 4a. Dify API呼び出し
- [ ] ヘッダーがASCII文字のみ（`latin-1` エラー対策）
- [ ] APIキーが正しくサニタイズされているか
- [ ] リトライロジックが実装されているか（503/429エラー対応）
- [ ] フォールバック処理が動作するか

### 4b. LINE Messaging API
- [ ] アクセストークンが正しく取得できているか
- [ ] メッセージ送信のリトライロジックが実装されているか
- [ ] エラー時のフォールバックが動作するか

### 4c. 動画処理フロー
- [ ] Cloud Storage への保存が成功するか
- [ ] 動画解析が正常に動作するか
- [ ] パス解析が正しく動作するか（リッチメニュー形式対応）
- [ ] Firestore への保存が正常か

### 4d. AIKA返答整形
- [ ] `format_aika_response` 関数が正常に動作するか
- [ ] 戦闘力が正しく計算・表示されるか
- [ ] 性別対応が正しく動作するか
- [ ] ジムへの動線が含まれているか

## 5. 失敗時の原因切り分け（優先度順）

### 5a. Module not found
- [ ] 該当パッケージが `package.json` または `requirements.txt` に含まれているか
- [ ] `npm install` または `pip install` が正常に完了したか

### 5b. Missing environment variable
- [ ] 環境変数名の綴りが正しいか
- [ ] Secret Manager から正しく読み込めているか
- [ ] デプロイ時に環境変数が設定されているか

### 5c. JSON parse error
- [ ] Secret Manager の値に余分な改行やBOMがないか
- [ ] JSON形式が正しいか（`json.loads()` で検証）

### 5d. エンコーディングエラー
- [ ] ヘッダーがASCII文字のみか（`latin-1` エラー対策）
- [ ] APIキーが正しくサニタイズされているか
- [ ] `urllib3` を使用しているか（Python側）

### 5e. パス解析エラー
- [ ] リッチメニュー形式（`videos/{userId}/{messageId}.mp4`）に対応しているか
- [ ] LIFFアプリ形式（`videos/{userId}/{jobId}/{filename}`）に対応しているか

## 6. 修復の確定対応

### 6a. ヘッダー処理の統一
- [ ] Python: `urllib3` を使用し、ヘッダーをASCII文字のみに
- [ ] Node.js: `sanitizeApiKey()` を使用し、ヘッダーをASCII文字のみに
- [ ] すべてのAPI呼び出しで統一されたヘッダー処理

### 6b. エラーハンドリングの強化
- [ ] すべての外部API呼び出しにリトライロジック
- [ ] フォールバック処理の実装
- [ ] 適切なログ出力

### 6c. コードの簡潔化
- [ ] 重複コードの除去
- [ ] 関数の分割（単一責任の原則）
- [ ] コメントの適切な追加

## 7. 再発防止策

### 7a. テストの追加
- [ ] ユニットテストの追加（主要関数）
- [ ] 統合テストの追加（エンドツーエンド）

### 7b. 監視・アラート
- [ ] Cloud Logging でのエラー監視
- [ ] アラート設定（エラー率、レイテンシー）

### 7c. ドキュメント
- [ ] コードコメントの充実
- [ ] README の更新
- [ ] トラブルシューティングガイドの作成

## 8. デプロイ前の最終確認

- [ ] すべてのチェック項目を完了
- [ ] ローカル環境での動作確認
- [ ] ステージング環境での動作確認（可能な場合）
- [ ] デプロイ計画の確認
- [ ] ロールバック計画の確認

---

**重要**: このチェックリストを順序通りに実行し、各項目を確認・修復することで、システムの安定性と信頼性が向上します。

