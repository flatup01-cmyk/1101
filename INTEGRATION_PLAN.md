# バックエンド統合計画

## 現在の状況

### フロントエンド（完成度: 70%）
- ✅ LIFFアプリ基盤完成
- ✅ Firebase SDK設定済み（firebase.js）
- ✅ 環境変数設定完了
- ⏳ 動画アップロードUI（未実装）
- ⏳ ユーザー入力フォーム（未実装）

### バックエンド（完成度: 30%）
- ✅ 基本的なMediaPipe動画解析（analyze_video.py）
- ⏳ キックボクシング専用スコアリング（未実装）
- ⏳ Cloud Functions化（未実装）
- ⏳ Dify API連携（未実装）
- ⏳ LINE Messaging API連携（未実装）

## 統合フロー

```
[ユーザー]
    ↓ 動画選択
[LIFFアプリ（フロントエンド）]
    ↓ アップロード
[Firebase Storage]
    ↓ トリガー（自動）
[Cloud Functions: Orchestrator]
    ↓ 呼び出し
[Cloud Functions: Processor]
    ↓ MediaPipe解析
[スコアリングロジック]
    ↓ JSON出力
[Dify API]
    ↓ AIKAセリフ生成
[LINE Messaging API]
    ↓ Push通知
[ユーザー（LINE）]
```

## 実装ステップ

### Phase 1: フロントエンド完成（優先度：高）

#### 1.1 動画アップロードUI
- ファイル選択ボタン
- 動画プレビュー
- アップロード進捗表示
- エラーハンドリング

#### 1.2 Firebase Storage連携
- 既存の`firebase.js`を使用
- ユーザーID取得（LIFF profileから）
- 動画アップロード実行

### Phase 2: バックエンド拡張（優先度：高）

#### 2.1 スコアリングロジック追加
`analyze_video.py`を拡張：
- パンチ速度評価
- キック角度評価
- ガード姿勢評価
- コア回転評価
- JSON形式で出力

#### 2.2 Cloud Functions準備
- `functions/`フォルダ作成
- `requirements.txt`作成
- 基本構造の作成

### Phase 3: API連携（優先度：中）

#### 3.1 Dify API連携
- APIエンドポイント設定
- プロンプト変数の送信
- AIKAセリフの取得

#### 3.2 LINE Messaging API連携
- Channel Access Token設定
- Push メッセージ送信

### Phase 4: 完全自動化（優先度：中）

#### 4.1 GCSトリガー設定
- Orchestrator Function作成
- 自動トリガー設定
- End-to-Endテスト

## 次のステップ

**今すぐ着手すべきこと：**
1. フロントエンド：動画アップロードUIの実装
2. バックエンド：スコアリングロジックの拡張

**両方を並行して進めることができます。**

