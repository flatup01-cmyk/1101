# 🏗️ AIKA18号 バトルスコープ アーキテクチャ図

## 📊 システムアーキテクチャ全体図

```
┌─────────────────────────────────────────────────────────────────┐
│                    【フロントエンド層】                           │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  LIFFアプリ（Netlify）                                    │  │
│  │  - 革命的UI（巨大ボタン、ツンデレ文言）                   │  │
│  │  - 動画選択・検証                                         │  │
│  │  - Firebase Anonymous認証                                │  │
│  └──────────────────┬───────────────────────────────────────┘  │
│                      │                                            │
│                      │ 【アトミックトランザクション】             │
│                      │ 1. Firestoreにjob作成                     │
│                      │ 2. Storageにアップロード                   │
│                      ↓                                            │
└──────────────────────┼───────────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│                【Firebase Storage層】                            │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Storage: videos/{userId}/{jobId}/{fileName}             │  │
│  │  - 100MB制限                                             │  │
│  │  - 10秒制限                                              │  │
│  └──────────────────┬───────────────────────────────────────┘  │
│                      │                                            │
│                      │ 【自動トリガー】                           │
│                      ↓                                            │
└──────────────────────┼───────────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│            【Cloud Functions層（要塞化版）】                      │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  process_video_trigger()                                  │  │
│  │                                                            │  │
│  │  【セキュリティ】                                          │  │
│  │  - Secret ManagerからLINEアクセストークン読み込み         │  │
│  │                                                            │  │
│  │  【冪等性確保】                                            │  │
│  │  - Firestoreトランザクションで処理済みチェック           │  │
│  │  - 重複実行を完全防止                                     │  │
│  │                                                            │  │
│  │  【データ整合性】                                          │  │
│  │  - アトミックトランザクション                             │  │
│  │  - エラー時はFirestoreも更新                              │  │
│  │                                                            │  │
│  │  【エラーハンドリング】                                    │  │
│  │  - 指数関数的バックオフ（4秒→8秒→最大60秒）               │  │
│  │  - 3回リトライ後、Cloud Loggingにアラート                 │  │
│  │                                                            │  │
│  │  処理フロー:                                               │  │
│  │  1. ファイルダウンロード                                   │  │
│  │  2. サイズ・長さ検証                                       │  │
│  │  3. MediaPipe解析                                         │  │
│  │  4. Dify API呼び出し                                      │  │
│  │  5. LINE API送信（リトライ付き）                          │  │
│  │  6. Firestore更新（通知済みフラグ付き）                   │  │
│  └──────────────────┬───────────────────────────────────────┘  │
│                      │                                            │
└──────────────────────┼───────────────────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
        ↓                             ↓
┌───────────────┐          ┌─────────────────────┐
│  Dify API     │          │  LINE Messaging API │
│  - AIKAセリフ │          │  - ユーザー通知     │
│  生成         │          │  - 指数関数的       │
└───────────────┘          │   バックオフ        │
                            └─────────────────────┘
```

## 🔐 セキュリティアーキテクチャ

```
┌────────────────────────────────────────────────────────────┐
│  Secret Manager                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  line-channel-access-token                          │  │
│  │  - 暗号化保存                                       │  │
│  │  - アクセス制御                                     │  │
│  └────────────────────┬─────────────────────────────────┘  │
│                       │                                     │
│                       │ Cloud Functions実行時に読み込み     │
│                       ↓                                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Cloud Functions                                      │  │
│  │  - 実行時に動的にシークレット取得                    │  │
│  │  - 環境変数へのフォールバック                        │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

## 💾 データ整合性保証アーキテクチャ

```
【アップロードフロー（アトミックトランザクション）】

1. 【フロントエンド】
   ├─ Firestore: job作成（status: 'pending'）
   │   └─ jobId取得
   │
   └─ Storage: アップロード（パス: videos/{userId}/{jobId}/{fileName}）

2. 【Cloud Functions（Storageトリガー）】
   ├─ 【冪等性チェック】Firestoreトランザクション
   │   ├─ job.status をチェック
   │   ├─ 'completed' → スキップ
   │   ├─ 'processing' → スキップ（重複実行防止）
   │   └─ 'pending' → 'processing'に更新（アトミック）
   │
   ├─ Storageから動画ダウンロード
   ├─ サイズ・長さ検証
   ├─ MediaPipe解析
   ├─ Dify API呼び出し
   ├─ LINE API送信（指数関数的バックオフ）
   │
   └─ 【データ整合性】Firestore更新
       └─ status: 'completed', notification_sent: true

【エラー時の整合性保証】
- エラー発生時も必ずFirestoreを更新
- status: 'error', error_message: '...'
- ユーザーにもエラー通知を試行
```

## 🔄 指数関数的バックオフ仕様

```
【LINE API送信リトライ戦略】

試行回数 | 待機時間 | 累積時間
---------|---------|----------
1回目    | 即座    | 0秒
2回目    | 4秒     | 4秒
3回目    | 8秒     | 12秒
4回目    | 16秒    | 28秒
最大     | 60秒    | 88秒

【実装】
@retry(
    stop=stop_after_attempt(3),  # 最大3回
    wait=wait_exponential(
        multiplier=2,            # 2倍ずつ増加
        min=4,                    # 最小4秒
        max=60                    # 最大60秒
    )
)
```

## 🛡️ 冪等性保証メカニズム

```
【重複実行防止】

Firestore Document: video_jobs/{jobId}
{
    "status": "pending|processing|completed|error",
    "notification_sent": boolean,
    "file_path": string,
    "user_id": string,
    ...
}

【トランザクションフロー】
1. トランザクション開始
2. statusをチェック
   - 'completed' → スキップ（既に処理済み）
   - 'processing' → スキップ（他プロセス処理中）
   - 'pending' → 'processing'に更新（アトミック）
3. トランザクションコミット
4. 処理実行
5. 完了時に'completed'に更新
```

## 📈 Cloud Logging連携

```
【アラート送信条件】

1. LINE API送信失敗（3回リトライ後）
   → severity: "CRITICAL"
   → 管理者に即座通知

2. 動画処理エラー
   → severity: "ERROR"
   → 詳細ログ保存

【アラートペイロード例】
{
    "severity": "CRITICAL",
    "message": "LINE通知失敗（3回リトライ後）",
    "user_id": "xxx",
    "job_id": "xxx",
    "error": "...",
    "timestamp": "2025-01-01T00:00:00Z"
}
```

## 🔄 データフロー詳細

```
【正常系フロー】

User → LIFF → Firebase Auth
  ↓
createVideoJob(userId, fileName)
  → Firestore: video_jobs/{jobId} (status: 'pending')
  ↓
uploadVideoToStorage(file, userId, jobId)
  → Storage: videos/{userId}/{jobId}/{fileName}
  ↓ (自動トリガー)
Cloud Functions: process_video_trigger()
  ↓
【冪等性チェック】Firestoreトランザクション
  → status: 'pending' → 'processing' (アトミック)
  ↓
動画ダウンロード・検証
  ↓
MediaPipe解析
  → scores: {punch_speed, guard_stability, ...}
  ↓
Dify API呼び出し
  → aika_message: "ツンデレセリフ"
  ↓
LINE API送信（指数関数的バックオフ）
  → 成功/失敗
  ↓
Firestore更新
  → status: 'completed'
  → notification_sent: true
  → analysis_result: {...}
  → aika_message: "..."
  ↓
完了 ✅
```

## ⚠️ 異常系フロー

```
【エラーケース1: Storageアップロード失敗】
LIFF → Firestore: job作成（成功）
  ↓
Storage: アップロード（失敗）
  ↓
Firestore: status: 'error'（手動更新またはタイムアウト）
→ ユーザーにエラー通知

【エラーケース2: Cloud Functions重複実行】
Function A: status: 'pending' → 'processing'（成功）
Function B: status: 'processing'を検出 → スキップ
→ 冪等性確保 ✅

【エラーケース3: LINE API送信失敗】
3回リトライ（指数関数的バックオフ）
  ↓
全て失敗
  ↓
Cloud Loggingにアラート送信
Firestore: notification_sent: false
→ 管理者に通知
→ 手動で再送信可能
```

---

**最終更新**: 2025-01-XX  
**作成者**: AI Assistant (Auto)

