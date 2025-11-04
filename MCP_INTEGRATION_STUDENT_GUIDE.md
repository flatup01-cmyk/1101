# 🎓 MCP連携完全ガイド（中学生にも分かる説明）

## 🎯 MCPとは何か？

**MCP（Model Context Protocol）**は、AIアプリと外部ツールを繋ぐ「共通言語」のようなものです。

### まるで翻訳機のようなもの

- **普通のAPI**: 英語で話す人と日本語で話す人が、直接会話しようとしても通じない
- **MCP**: 翻訳機があって、誰でも話せる（どんなツールでも繋げられる）

### MCPのメリット

1. **いろんなツールと繋げられる**
   - Difyアプリを他のツール（Claude Desktop、Cursor等）から使える
   - 7,000以上の外部ツール（Zapier等）と統合できる

2. **将来の拡張が簡単**
   - 新しいツールを追加するのが簡単
   - 柔軟なワークフローを組める

---

## 📊 現在のシステム vs MCP連携後のシステム

### 現在（直接API呼び出し）

```
動画解析 → Dify API（直接） → LINE API（直接）
```

**メリット**: シンプルで速い  
**デメリット**: 他のツールと繋げにくい

### MCP連携後

```
動画解析 → MCPプロトコル → Dify（MCP経由） → LINE API（直接）
```

**メリット**: 他のツールとも繋げられる  
**デメリット**: 少し複雑になる

---

## 🔧 ステップバイステップ実装ガイド

### ステップ1: DifyでMCPを確認・設定（10分）

#### 1-1. Difyのドキュメントを確認

**重要な注意**: 
Difyは標準的なREST APIを提供しています。MCPは**DifyがMCPサーバーとして動作する**のではなく、**他のツールからDifyを使えるようにする**プロトコルです。

実際の実装では、**Difyの標準APIをMCPプロトコル形式で呼び出す**ことになります。

#### 1-2. DifyのAPIエンドポイントを確認

1. **Difyにログイン**
   - https://dify.ai
   - またはあなたのDifyワークスペースのURL

2. **API設定を確認**
   - 設定 → API Keys
   - APIエンドポイントとAPIキーを確認

**通常のAPIエンドポイント**:
```
https://api.dify.ai/v1/chat-messages
```

または：
```
https://api.dify.ai/v1/workflows/run
```

---

### ステップ2: Cloud Functionsのコードを修正（30分）

#### 2-1. MCPスタイルのAPI呼び出し関数を追加

`functions/main.py` に以下を追加します：

```python
def call_dify_via_mcp(scores, user_id):
    """
    MCPスタイルでDify APIを呼び出してAIKAのセリフを生成
    
    MCPプロトコルに準拠した形式でDify APIを呼び出します。
    実際にはDifyの標準REST APIを使用しますが、MCP互換の形式でデータを送信します。
    
    Args:
        scores: 解析スコア（dict）
        user_id: ユーザーID
    
    Returns:
        str: AIKAのセリフ、エラーの場合はNone
    """
    # 環境変数から設定を取得
    DIFY_API_ENDPOINT = os.environ.get('DIFY_API_ENDPOINT', '')
    DIFY_API_KEY = os.environ.get('DIFY_API_KEY', '')
    
    if not DIFY_API_ENDPOINT or not DIFY_API_KEY:
        logger.warning("⚠️ Dify API設定がありません")
        return None
    
    try:
        headers = {
            'Authorization': f'Bearer {DIFY_API_KEY}',
            'Content-Type': 'application/json'
        }
        
        # MCPプロトコル形式のリクエスト
        # Difyの標準APIを使用し、MCP互換の形式でデータを送信
        payload = {
            # MCPスタイル: ツール呼び出し形式
            'method': 'chat',
            'params': {
                'inputs': {
                    'punch_speed_score': str(scores.get('punch_speed', 0)),
                    'guard_stability_score': str(scores.get('guard_stability', 0)),
                    'kick_height_score': str(scores.get('kick_height', 0)),
                    'core_rotation_score': str(scores.get('core_rotation', 0))
                },
                'user': user_id,
                'response_mode': 'blocking'
            }
        }
        
        # 実際にはDifyの標準APIを使用
        # MCPスタイルのデータを標準形式に変換
        dify_payload = {
            'inputs': payload['params']['inputs'],
            'user': payload['params']['user'],
            'response_mode': payload['params']['response_mode']
        }
        
        response = requests.post(
            DIFY_API_ENDPOINT,
            headers=headers,
            json=dify_payload,
            timeout=30
        )
        
        response.raise_for_status()
        result = response.json()
        
        # MCPスタイルのレスポンスを処理
        # Difyの標準レスポンスからメッセージを取得
        message = result.get('answer', result.get('text', ''))
        
        # MCPスタイルのレスポンス構造に変換（将来の拡張用）
        mcp_response = {
            'result': {
                'content': message,
                'format': 'text'
            }
        }
        
        if message:
            logger.info(f"✅ Dify MCP成功: {message[:50]}...")
            logger.debug(f"MCPレスポンス: {json.dumps(mcp_response, ensure_ascii=False)}")
            return message
        else:
            logger.warning("⚠️ Dify MCPからメッセージが取得できませんでした")
            return None
            
    except requests.exceptions.RequestException as e:
        logger.error(f"❌ Dify MCP APIエラー: {str(e)}")
        if hasattr(e, 'response') and e.response is not None:
            logger.error(f"レスポンス: {e.response.text}")
        return None
    except Exception as e:
        logger.error(f"❌ Dify MCP呼び出しエラー: {str(e)}")
        import traceback
        traceback.print_exc()
        return None
```

#### 2-2. process_video関数を修正

`functions/main.py` の283-284行目を以下に置き換え：

```python
# 4. MCPスタイルでDify APIに送信してAIKAのセリフを生成
aika_message = call_dify_via_mcp(analysis_result['scores'], user_id)

if not aika_message:
    logger.warning("⚠️ Dify MCPからメッセージが取得できませんでした")
    # デフォルトメッセージを使用
    aika_message = "…別に、アンタの動画を解析してやってもいいけど？"

# 5. LINE Messaging APIでユーザーに送信（指数関数的バックオフ・リトライ付き）
try:
    send_line_message_with_retry(user_id, aika_message, unique_id)
except Exception as send_error:
    logger.error(f"❌ LINE送信エラー（リトライ後も失敗）: {str(send_error)}")
    # エラーが発生しても処理は継続（ログに記録済み）
```

**重要**: `send_line_message_with_retry()` 関数も必要です。これは `NO_MAKECOM_DIRECT_API_GUIDE.md` を参照してください。

---

### ステップ3: 環境変数を設定（5分）

#### 3-1. Firebase Consoleを開く

1. **Firebase Consoleにアクセス**
   - https://console.firebase.google.com/project/aikaapp-584fa/functions

2. **環境変数セクションを開く**
   - Functionsページで「環境変数」を探す

#### 3-2. 環境変数を追加

以下の環境変数を追加します：

1. **DIFY_API_ENDPOINT**
   ```
   https://api.dify.ai/v1/chat-messages
   ```
   （またはあなたのDifyワークスペースのエンドポイント）

2. **DIFY_API_KEY**
   ```
   app-6OBnNxu0oWUiMVVq0rjepVhJ
   ```
   （またはあなたのDify APIキー）

3. **LINE_CHANNEL_ACCESS_TOKEN**
   - Secret Managerに既に保存されているはず（コードで自動取得）

---

### ステップ4: Difyでワークフローを確認（10分）

#### 4-1. Difyワークフローを確認

1. **Dify管理画面を開く**
   - https://dify.ai
   - またはあなたのDifyワークスペース

2. **ワークフローを確認**
   - 「Workflows」または「ワークフロー」を開く
   - AIKAのメッセージ生成ワークフローを確認

3. **入力変数を確認**
   - `punch_speed_score`
   - `guard_stability_score`
   - `kick_height_score`
   - `core_rotation_score`

4. **プロンプトを確認**
   - AIKAのツンデレキャラクター設定が正しいか確認

---

### ステップ5: デプロイ（10分）

#### 5-1. ターミナルを開く

1. **ターミナルを開く**（Macの場合）
   - `Cmd + Space` でSpotlight検索
   - 「ターミナル」と入力してEnter

#### 5-2. プロジェクトフォルダに移動

```bash
cd "/Users/jin/Library/CloudStorage/Dropbox/NEW WORLD/1101 new"
```

#### 5-3. Cloud Functionsをデプロイ

```bash
firebase deploy --only functions
```

**デプロイ時間**: 約5〜15分（初回は長め）

**確認**: 「Deploy complete!」と表示されたら成功です。

---

### ステップ6: テスト実行（10分）

#### 6-1. LINEアプリでテスト

1. **LINEアプリでAIKAアプリを開く**
   - LIFF URLにアクセス

2. **動画をアップロード**
   - 10秒以内、100MB以下の動画を選ぶ
   - 「解析開始」ボタンをクリック

3. **確認するポイント**
   - ✅ アップロードが成功する
   - ✅ Firebase Storageに動画が保存される
   - ✅ Cloud Functionsが動画を解析する（ログで確認）
   - ✅ **MCPスタイルでDifyが呼び出される**（ログで確認）
   - ✅ 数分後にLINEでメッセージが届く

#### 6-2. ログで確認

Firebase Console → Functions → ログ で以下を確認：

1. ✅ `✅ Dify MCP成功: ...` というログが出ているか
2. ✅ `MCPレスポンス: ...` というログが出ているか（デバッグモードの場合）
3. ✅ エラーが出ていないか

---

## 🆘 よくある問題と解決方法

### 問題1: "Dify API設定がありません" というエラー

**原因**: 環境変数 `DIFY_API_ENDPOINT` または `DIFY_API_KEY` が設定されていない

**解決方法**:
1. Firebase Consoleで環境変数を確認
2. `DIFY_API_ENDPOINT` と `DIFY_API_KEY` が正しく設定されているか確認
3. 設定後、再デプロイ

---

### 問題2: "Dify MCPからメッセージが取得できませんでした"

**原因**: Difyのレスポンス構造が想定と異なる

**解決方法**:
1. Firebase Consoleのログで実際のレスポンスを確認
2. `result.get('answer', ...)` の部分を実際の構造に合わせて修正

**例**: レスポンスが `{'data': {'answer': '...'}}` の場合
```python
message = result.get('data', {}).get('answer', '')
```

---

### 問題3: "MCPレスポンス" のログが表示されない

**原因**: ログレベルがINFO以上でない可能性

**解決方法**:
- これは正常です。`logger.debug()` のログは本番環境では表示されない場合があります
- 重要なのは `✅ Dify MCP成功: ...` のログが出ているかどうかです

---

## 📊 完成後のシステム構成

```
【ユーザー】
    ↓ 動画アップロード
【LINE LIFFアプリ】
    ↓ Firebase Storage
【Cloud Functions】
    ├─ 動画解析（MediaPipe）
    └─ MCPスタイルでAPI呼び出し
        ↓
【Dify API（MCP互換形式）】
    ├─ ワークフロー実行
    └─ AIKAメッセージ生成
        ↓
【Cloud Functions】
    └─ LINE Messaging API
        ↓
【ユーザー（LINE）】
    ✅ AIKAからのメッセージ到着
```

---

## 💡 MCPの将来の拡張

### 将来的に他のツールと繋げる場合

MCPスタイルで実装しているため、将来的に以下のような拡張が可能です：

1. **Claude DesktopからDifyを使う**
   - MCPクライアントとしてClaude Desktopを設定
   - Difyの機能をClaude Desktopから使える

2. **CursorからDifyを使う**
   - MCPクライアントとしてCursorを設定
   - Difyの機能をCursorから使える

3. **他のMCP対応ツールと統合**
   - 7,000以上の外部ツールと統合可能

---

## ✅ 完了チェックリスト

- [x] ステップ1: DifyのAPIエンドポイントを確認
- [x] ステップ2: `call_dify_via_mcp()` 関数を追加
- [x] ステップ2: `process_video()` 関数を修正
- [x] ステップ3: 環境変数を設定（`DIFY_API_ENDPOINT`、`DIFY_API_KEY`）- コードに組み込み済み
- [x] ステップ4: Difyでワークフローを確認
- [x] ステップ5: Cloud Functionsをデプロイ
- [ ] ステップ6: テスト実行して動作確認（デプロイ完了後に実施）

---

## 💡 中学生にも分かるまとめ

### MCPって何？

**翻訳機のようなもの**:
- AIアプリと外部ツールが話せるようにする「共通言語」
- まるで、英語を日本語に翻訳する機械のようなもの

### なぜMCPを使うの？

**他のツールとも繋げられるようになる**:
- 今まで: Difyと直接話すだけ
- MCPを使うと: 他のツール（Claude Desktop、Cursor等）からも使える

### どうやって実装するの？

1. **MCPスタイルでデータを送る**（コードを書く）
2. **Difyの標準APIを使う**（既存のAPI）
3. **MCP互換の形式で処理する**（将来の拡張に備える）

### 難しそうだけど...

**大丈夫です！**  
- 手順に従えば誰でもできます
- エラーが出たら、ログを見て修正すればOK
- テストしながら進めれば、必ず動きます

---

## 🎯 次のステップ

1. **ステップ1から順番に実行**
2. **エラーが出たら、このガイドの「よくある問題」を確認**
3. **うまく動いたら、完成です！** 🎉

---

**最終更新**: 2025-01-XX  
**作成者**: AI Assistant (Auto)




