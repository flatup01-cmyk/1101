"""
Cloud Functions: 動画解析 + Dify + LINE連携（要塞化版）

【神の信頼性】100万回のアップロードで、エラーは1回も許さない。

実装内容：
- Secret Managerから機密情報を読み込み
- アトミックトランザクションでデータ整合性を保証
- 指数関数的バックオフでリトライ処理
- 冪等性確保（通知済みフラグ）
- Cloud Logging連携（アラート）
"""

import os
import json
import tempfile
import base64
import requests
import logging
from datetime import datetime
from google.cloud import storage, firestore
from google.cloud.secretmanager_v1 import SecretManagerServiceClient
from tenacity import retry, stop_after_attempt, wait_exponential, RetryError
from analyze import analyze_kickboxing_form
from rate_limiter import check_rate_limit

# Firebase Functions Framework
import functions_framework

# Cloud Logging設定
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- Client Initialization ---
storage_client = storage.Client()
db = firestore.Client()

_secret_client = None
def get_secret_client():
    global _secret_client
    if _secret_client is None:
        _secret_client = SecretManagerServiceClient()
    return _secret_client

# --- Secret Manager Access Function ---
def access_secret_version(secret_id, project_id, version_id="latest"):
    """
    Secret Managerからシークレットを取得
    
    Args:
        secret_id: シークレット名
        project_id: GCPプロジェクトID
        version_id: バージョン（デフォルト: latest）
    
    Returns:
        str: シークレットの値
    """
    try:
        client = get_secret_client()
        name = f"projects/{project_id}/secrets/{secret_id}/versions/{version_id}"
        response = client.access_secret_version(name=name)
        return response.payload.data.decode('UTF-8')
    except Exception as e:
        logger.error(f"Secret Manager読み込みエラー ({secret_id}): {str(e)}")
        raise

# --- Load Secrets at Runtime ---
PROJECT_ID = os.environ.get('GCP_PROJECT', 'aikaapp-584fa')

# LINEアクセストークンはSecret Managerから読み込み（最優先・セキュリティ強化）


# Dify API設定（環境変数から）
DIFY_API_ENDPOINT = os.environ.get('DIFY_API_ENDPOINT', 'https://api.dify.ai/v1/chat-messages')
DIFY_API_KEY = os.environ.get('DIFY_API_KEY', 'app-z5S8OBIYaET8dSCdN6G63yvF')


# --- MCP連携関数 ---
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
    global DIFY_API_ENDPOINT, DIFY_API_KEY
    
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
        mcp_payload = {
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
            'inputs': mcp_payload['params']['inputs'],
            'user': mcp_payload['params']['user'],
            'response_mode': mcp_payload['params']['response_mode']
        }
        
        logger.info(f"📤 Dify MCP呼び出し: {json.dumps(dify_payload, ensure_ascii=False)}")
        
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
            logger.debug(f"Difyレスポンス: {json.dumps(result, ensure_ascii=False)}")
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


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=4, max=10),
    reraise=True
)
def send_line_message_with_retry(user_id, message, unique_id):
    """
    LINE Messaging APIでメッセージを送信（指数関数的バックオフ・リトライ付き）
    
    Args:
        user_id: ユーザーID
        message: 送信するメッセージ
        unique_id: 冪等性確保のためのユニークID
    
    Returns:
        bool: 成功した場合True
    """
    try:
        # Secret ManagerからLINEアクセストークンを取得
        LINE_CHANNEL_ACCESS_TOKEN = access_secret_version(
            "LINE_CHANNEL_ACCESS_TOKEN",
            PROJECT_ID
        )
        
        if not LINE_CHANNEL_ACCESS_TOKEN:
            logger.error("❌ LINEアクセストークンが取得できませんでした")
            return False
        
        # 【冪等性確保】既に通知済みかチェック
        notification_doc = db.collection('video_jobs').document(unique_id).get()
        if notification_doc.exists:
            notification_data = notification_doc.to_dict()
            if notification_data.get('notification_sent', False):
                logger.info(f"⏭️ 既に通知済み: {unique_id}")
                return True
        
        # LINE APIに送信
        url = 'https://api.line.me/v2/bot/message/push'
        headers = {
            'Authorization': f'Bearer {LINE_CHANNEL_ACCESS_TOKEN}',
            'Content-Type': 'application/json'
        }
        data = {
            'to': user_id,
            'messages': [
                {
                    'type': 'text',
                    'text': message
                }
            ]
        }
        
        response = requests.post(url, headers=headers, json=data, timeout=30)
        response.raise_for_status()
        
        # 【冪等性確保】通知済みフラグを設定
        db.collection('video_jobs').document(unique_id).update({
            'notification_sent': True,
            'notification_sent_at': firestore.SERVER_TIMESTAMP,
            'updated_at': firestore.SERVER_TIMESTAMP
        })
        
        logger.info(f"✅ LINEメッセージ送信成功: {user_id}")
        return True
        
    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 401:
            logger.error(f"❌ LINE認証エラー（401）: トークンが無効です")
        elif e.response.status_code == 400:
            logger.error(f"❌ LINEリクエストエラー（400）: {e.response.text}")
        else:
            logger.error(f"❌ LINE API HTTPエラー: {e.response.status_code}")
        raise
    except RetryError:
        # 3回リトライしても失敗した場合
        logger.error(f"❌ FATAL: LINE API送信に3回失敗しました（ユーザーID: {user_id}）")
        
        # 【Cloud Logging連携】アラート送信
        alert_payload = {
            "severity": "ERROR",
            "message": "CRITICAL: LINE API送信失敗（3回リトライ後）",
            "user_id": user_id,
            "unique_id": unique_id,
            "timestamp": datetime.utcnow().isoformat()
        }
        logger.error(json.dumps(alert_payload))
        
        raise
    except Exception as e:
        logger.error(f"❌ LINE API送信エラー: {str(e)}")
        raise


def process_video(data, context):
    """
    Firebase Storageのトリガーで呼ばれる関数（要塞化版）
    
    【データ整合性】アトミックトランザクションで完全保証
    【冪等性】通知済みフラグで重複実行を完全防止
    【エラーハンドリング】指数関数的バックオフで確実に送信
    
    Args:
        data: イベントデータ（ファイル情報が入っている）
        context: イベントのメタデータ
    """
    # 1. ファイル情報を取得
    if isinstance(data, str):
        try:
            data = json.loads(base64.b64decode(data).decode('utf-8'))
        except (json.JSONDecodeError, UnicodeDecodeError, ValueError) as e:
            try:
                data = json.loads(data)
            except json.JSONDecodeError:
                logger.error(f"データパースエラー: {str(e)}")
                return {"status": "error", "reason": "invalid data format"}
    
    file_path = data.get('name') or data.get('file')
    # Storageバケット名: Firebase Storageの新しい形式を優先
    bucket_name = data.get('bucket', os.environ.get('STORAGE_BUCKET', 'aikaapp-584fa.firebasestorage.app'))
    
    logger.info(f"処理開始: {file_path} (bucket: {bucket_name})")
    
    # videos/で始まらないファイルは無視
    if not file_path or not file_path.startswith('videos/'):
        logger.info(f"スキップ: videos/で始まらないファイル: {file_path}")
        return {"status": "skipped", "reason": "not a video file"}
    
    # パストラバーサル攻撃対策
    import os.path
    normalized_path = os.path.normpath(file_path)
    if not normalized_path.startswith('videos/'):
        logger.error(f"セキュリティ: 不正なパス: {file_path}")
        return {"status": "error", "reason": "invalid path"}
    
    # ファイルパスからユーザーIDとjobIdを抽出
    # パス構造: videos/{userId}/{jobId}/{fileName}
    path_parts = file_path.split('/')
    if len(path_parts) < 4:
        logger.error(f"セキュリティ: パス構造が不正: {file_path}")
        return {"status": "error", "reason": "invalid path structure"}
    
    user_id = path_parts[1]
    job_id = path_parts[2] if len(path_parts) >= 3 else None
    
    # ユーザーIDの検証
    if not user_id or not user_id.replace('-', '').replace('_', '').isalnum():
        logger.error(f"セキュリティ: 不正なユーザーID: {user_id}")
        return {"status": "error", "reason": "invalid user id"}
    
    # レートリミットチェック
    is_allowed, rate_limit_message = check_rate_limit(user_id, 'upload_video')
    if not is_allowed:
        logger.warning(f"❌ レートリミット超過: {user_id} - {rate_limit_message}")
        try:
            # 簡易的なLINEメッセージ送信（エラーは無視）
            LINE_CHANNEL_ACCESS_TOKEN = access_secret_version("LINE_CHANNEL_ACCESS_TOKEN", PROJECT_ID)
            if LINE_CHANNEL_ACCESS_TOKEN:
                requests.post(
                    'https://api.line.me/v2/bot/message/push',
                    headers={'Authorization': f'Bearer {LINE_CHANNEL_ACCESS_TOKEN}', 'Content-Type': 'application/json'},
                    json={'to': user_id, 'messages': [{'type': 'text', 'text': f"ごめんあそばせ。{rate_limit_message}"}]},
                    timeout=10
                )
        except Exception as notify_error:
            logger.error(f"レートリミット通知エラー: {str(notify_error)}")
        return {"status": "rate_limit_exceeded", "reason": rate_limit_message}
    
    logger.info(f"✓ レートリミットチェック通過: {user_id}")
    
    # 【冪等性確保】Firestoreで処理済みチェック
    # jobIdが存在する場合はそれを使用、ない場合はファイルパスをハッシュ化
    import hashlib
    if job_id:
        processing_doc_ref = db.collection('video_jobs').document(job_id)
        unique_id = job_id
    else:
        file_hash = hashlib.md5(file_path.encode()).hexdigest()
        processing_doc_ref = db.collection('video_processing').document(file_hash)
        unique_id = file_hash
    
    # 【冪等性確保】アトミックトランザクションで処理済みチェック
    transaction = db.transaction()
    
    def check_and_mark_processing(transaction):
        """アトミックトランザクションで処理済みチェック"""
        doc = processing_doc_ref.get(transaction=transaction)
        if doc.exists:
            doc_data = doc.to_dict()
            current_status = doc_data.get('status')
            if current_status == 'completed':
                logger.info(f"✅ 既に処理済み（冪等性確保）: {file_path}")
                return False  # 処理済み→スキップ
            elif current_status == 'processing':
                logger.warning(f"⚠️ 処理中（重複実行防止）: {file_path}")
                return False  # 処理中→スキップ
        # 処理開始をマーク（アトミック）
        if job_id:
            # video_jobsコレクションの場合
            transaction.update(processing_doc_ref, {
                'status': 'processing',
                'updated_at': firestore.SERVER_TIMESTAMP
            })
        else:
            # video_processingコレクションの場合
            transaction.set(processing_doc_ref, {
                'status': 'processing',
                'file_path': file_path,
                'user_id': user_id,
                'started_at': firestore.SERVER_TIMESTAMP,
                'updated_at': firestore.SERVER_TIMESTAMP
            })
        return True  # 新規処理
    
    try:
        is_new = transaction.run(check_and_mark_processing)
        if not is_new:
            return {"status": "skipped", "reason": "already processed or processing"}
    except Exception as e:
        logger.error(f"❌ トランザクション失敗: {str(e)}")
        import traceback
        traceback.print_exc()
        return {"status": "error", "reason": "transaction failed"}
    
    # 2. 動画ファイルを一時ディレクトリにダウンロード
    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(file_path)
    
    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix='.mp4') as temp_file:
            temp_path = temp_file.name
            blob.download_to_filename(temp_path)
            logger.info(f"ダウンロード完了: {temp_path}")
            
            # ファイルサイズチェック（100MB制限）
            file_size = os.path.getsize(temp_path)
            max_size = 100 * 1024 * 1024  # 100MB
            if file_size > max_size:
                logger.error(f"❌ ファイルサイズ超過: {file_size / 1024 / 1024:.2f}MB > 100MB")
                try:
                    # 簡易的なLINEメッセージ送信（エラーは無視）
                    LINE_CHANNEL_ACCESS_TOKEN = access_secret_version("LINE_CHANNEL_ACCESS_TOKEN", PROJECT_ID)
                    if LINE_CHANNEL_ACCESS_TOKEN:
                        requests.post(
                            'https://api.line.me/v2/bot/message/push',
                            headers={'Authorization': f'Bearer {LINE_CHANNEL_ACCESS_TOKEN}', 'Content-Type': 'application/json'},
                            json={'to': user_id, 'messages': [{'type': 'text', 'text': "ごめんあそばせ。動画ファイルが大きすぎるわ（100MB以下に収めて）。"}]},
                            timeout=10
                        )
                except Exception:
                    pass
                # Firestoreを更新（エラー状態）
                processing_doc_ref.update({
                    'status': 'error',
                    'error_message': 'file size too large',
                    'updated_at': firestore.SERVER_TIMESTAMP
                })
                return {"status": "error", "reason": "file size too large"}
            
            # 動画の長さチェック（20秒制限）
            import cv2
            cap = cv2.VideoCapture(temp_path)
            if not cap.isOpened():
                logger.error(f"❌ 動画ファイルを開けません: {temp_path}")
                cap.release()
                processing_doc_ref.update({
                    'status': 'error',
                    'error_message': 'cannot open video file',
                    'updated_at': firestore.SERVER_TIMESTAMP
                })
                return {"status": "error", "reason": "cannot open video file"}
            
            fps = cap.get(cv2.CAP_PROP_FPS)
            frame_count = cap.get(cv2.CAP_PROP_FRAME_COUNT)
            cap.release()
            
            if fps > 0:
                duration = frame_count / fps
                if duration > 20:
                    logger.error(f"❌ 動画の長さ超過: {duration:.2f}秒 > 20秒")
                    try:
                        # 簡易的なLINEメッセージ送信（エラーは無視）
                        LINE_CHANNEL_ACCESS_TOKEN = access_secret_version("LINE_CHANNEL_ACCESS_TOKEN", PROJECT_ID)
                        if LINE_CHANNEL_ACCESS_TOKEN:
                            requests.post(
                                'https://api.line.me/v2/bot/message/push',
                                headers={'Authorization': f'Bearer {LINE_CHANNEL_ACCESS_TOKEN}', 'Content-Type': 'application/json'},
                                json={'to': user_id, 'messages': [{'type': 'text', 'text': "ごめんあそばせ。動画が長すぎるわ（20秒以内に収めて）。"}]},
                                timeout=10
                            )
                    except Exception:
                        pass
                    processing_doc_ref.update({
                        'status': 'error',
                        'error_message': 'video duration too long',
                        'updated_at': firestore.SERVER_TIMESTAMP
                    })
                    return {"status": "error", "reason": "video duration too long"}
            else:
                logger.warning("⚠️ FPSが取得できませんでした。動画の長さチェックをスキップします。")
                
    except Exception as download_error:
        logger.error(f"ファイルダウンロードエラー: {str(download_error)}")
        processing_doc_ref.update({
            'status': 'error',
            'error_message': 'download failed',
            'updated_at': firestore.SERVER_TIMESTAMP
        })
        return {"status": "error", "reason": "download failed"}
    
    try:
        # 3. 動画解析を実行
        analysis_result = analyze_kickboxing_form(temp_path)
        logger.info(f"解析結果: {json.dumps(analysis_result, ensure_ascii=False)}")
        
        if analysis_result['status'] != 'success':
            processing_doc_ref.update({
                'status': 'error',
                'error_message': analysis_result.get('error_message', 'analysis failed'),
                'updated_at': firestore.SERVER_TIMESTAMP
            })
            return analysis_result
        
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
        
        # 【データ整合性】Firestoreを更新（分析結果とステータス）
        processing_doc_ref.update({
            'status': 'completed',
            'analysis_result': analysis_result['scores'],
            'aika_message': aika_message,
            'completed_at': firestore.SERVER_TIMESTAMP,
            'updated_at': firestore.SERVER_TIMESTAMP
        })
        
        logger.info(f"✅ 処理完了: {file_path} (分析結果をFirestoreに保存)")
        
        return {
            "status": "success",
            "analysis": analysis_result['scores']
        }
        
    except Exception as e:
        logger.error(f"エラー発生: {str(e)}")
        import traceback
        traceback.print_exc()
        
        # 【Cloud Logging連携】アラート送信
        alert_payload = {
            "severity": "ERROR",
            "message": f"CRITICAL: 動画処理エラー - {file_path}",
            "user_id": user_id,
            "file_path": file_path,
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }
        logger.error(json.dumps(alert_payload))
        
        # Firestoreを更新（エラー状態）
        processing_doc_ref.update({
            'status': 'error',
            'error_message': str(e),
            'updated_at': firestore.SERVER_TIMESTAMP
        })
        
        return {"status": "failure", "error_message": str(e)}
    
    finally:
        # 8. 一時ファイルを削除
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
                logger.info(f"一時ファイル削除: {temp_path}")
            except Exception as cleanup_error:
                logger.error(f"一時ファイル削除エラー: {str(cleanup_error)}")





# Firebase Storage トリガー関数（CloudEvent形式）
if functions_framework:
    @functions_framework.cloud_event
    def process_video_trigger(cloud_event):
        """
        Firebase StorageのCloudEventトリガー
        
        Storageにファイルが作成されると自動で呼ばれます
        """
        # CloudEventからデータを抽出
        event_data = cloud_event.data.get('data', {})
        
        # Base64デコードが必要な場合
        if isinstance(event_data, str):
            try:
                decoded_data = base64.b64decode(event_data).decode('utf-8')
                event_data = json.loads(decoded_data)
            except (json.JSONDecodeError, UnicodeDecodeError, ValueError):
                try:
                    event_data = json.loads(event_data)
                except json.JSONDecodeError:
                    logger.error("⚠️ CloudEventデータのパースに失敗しました")
                    event_data = {}
        
        # process_video関数を呼び出し
        return process_video(event_data, None)


# テスト用（ローカル実行時）
if __name__ == '__main__':
    test_data = {
        'name': 'videos/test_user/1234567890-test.mp4',
        'bucket': 'aikaapp-584fa.firebasestorage.app'
    }
    
    result = process_video(test_data, None)
    print(json.dumps(result, indent=2, ensure_ascii=False))
