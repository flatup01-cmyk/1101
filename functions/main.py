"""
Cloud Functions: 動画解析 + Dify + LINE連携

処理の流れ：
1. Firebase Storageから動画をダウンロード
2. MediaPipeで動画解析
3. Dify APIに解析結果を送信 → AIKAのセリフ生成
4. LINE Messaging APIでユーザーに送信
"""

import os
import json
import tempfile
import requests
import base64
from google.cloud import storage
from analyze import analyze_kickboxing_form
from rate_limiter import check_rate_limit

# Firebase Functions Framework
try:
    import functions_framework
except ImportError:
    # ローカル開発時はスキップ
    functions_framework = None

# Cloud Storageクライアント
storage_client = storage.Client()

# 環境変数から設定を取得
DIFY_API_ENDPOINT = os.environ.get('DIFY_API_ENDPOINT', '')
DIFY_API_KEY = os.environ.get('DIFY_API_KEY', '')
LINE_CHANNEL_ACCESS_TOKEN = os.environ.get('LINE_CHANNEL_ACCESS_TOKEN', '')


def process_video(data, context):
    """
    Firebase Storageのトリガーで呼ばれる関数
    
    Args:
        data: イベントデータ（ファイル情報が入っている）
        context: イベントのメタデータ
    """
    
    # 1. ファイル情報を取得
    # データがdictの場合はそのまま、Base64の場合はデコード
    if isinstance(data, str):
        try:
            data = json.loads(base64.b64decode(data).decode('utf-8'))
        except (json.JSONDecodeError, UnicodeDecodeError, ValueError) as e:
            try:
                data = json.loads(data)
            except json.JSONDecodeError:
                print(f"データパースエラー: {str(e)}")
                return {"status": "error", "reason": "invalid data format"}
    
    file_path = data.get('name') or data.get('file')  # 例: videos/user123/1234567890-video.mp4
    bucket_name = data.get('bucket', 'aikaapp-584fa.appspot.com')
    
    # デバッグ用ログ
    print(f"処理開始: {file_path} (bucket: {bucket_name})")
    
    # videos/で始まらないファイルは無視
    if not file_path or not file_path.startswith('videos/'):
        print(f"スキップ: videos/で始まらないファイル: {file_path}")
        return {"status": "skipped", "reason": "not a video file"}
    
    # パストラバーサル攻撃対策: パスを正規化して検証
    import os.path
    normalized_path = os.path.normpath(file_path)
    if not normalized_path.startswith('videos/'):
        print(f"セキュリティ: 不正なパス: {file_path}")
        return {"status": "error", "reason": "invalid path"}
    
    # ファイルパスからユーザーIDを抽出（レートリミットチェック用）
    path_parts = file_path.split('/')
    if len(path_parts) < 3:
        print(f"セキュリティ: パス構造が不正: {file_path}")
        return {"status": "error", "reason": "invalid path structure"}
    
    user_id = path_parts[1]
    # ユーザーIDの検証（英数字とハイフン、アンダースコアのみ許可）
    if not user_id or not user_id.replace('-', '').replace('_', '').isalnum():
        print(f"セキュリティ: 不正なユーザーID: {user_id}")
        return {"status": "error", "reason": "invalid user id"}
    
    # レートリミットチェック
    is_allowed, rate_limit_message = check_rate_limit(user_id, 'upload_video')
    if not is_allowed:
        print(f"❌ レートリミット超過: {user_id} - {rate_limit_message}")
        # ユーザーに通知
        try:
            send_line_message(user_id, f"ごめんあそばせ。{rate_limit_message}")
        except Exception as notify_error:
            print(f"レートリミット通知エラー: {str(notify_error)}")
        return {
            "status": "rate_limit_exceeded",
            "reason": rate_limit_message
        }
    
    print(f"✓ レートリミットチェック通過: {user_id}")
    
    # 2. 動画ファイルを一時ディレクトリにダウンロード
    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(file_path)
    
    # 一時ファイルに保存
    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix='.mp4') as temp_file:
            temp_path = temp_file.name
            blob.download_to_filename(temp_path)
            print(f"ダウンロード完了: {temp_path}")
    except Exception as download_error:
        print(f"ファイルダウンロードエラー: {str(download_error)}")
        return {"status": "error", "reason": "download failed"}
    
    try:
        # 3. 動画解析を実行
        analysis_result = analyze_kickboxing_form(temp_path)
        print(f"解析結果: {json.dumps(analysis_result, ensure_ascii=False)}")
        
        if analysis_result['status'] != 'success':
            return analysis_result
        
        # 4. Dify APIに送信してAIKAのセリフを生成
        aika_message = call_dify_api(analysis_result['scores'], user_id)
        if not aika_message:
            print("⚠️ Dify APIからメッセージが取得できませんでした")
            aika_message = "ふふ、動画を受け取ったわ。解析中よ。しばらくお待ちなさい。"
        
        # 6. LINE Messaging APIでユーザーに送信
        send_line_message(user_id, aika_message)
        
        # 7. 成功を返す
        return {
            "status": "success",
            "analysis": analysis_result['scores'],
            "message_sent": True
        }
        
    except Exception as e:
        print(f"エラー発生: {str(e)}")
        import traceback
        traceback.print_exc()
        
        # エラー時もユーザーに通知（user_idは既に抽出済み）
        try:
            send_line_message(user_id, "ごめんあそばせ。今、スカウターの調子が悪いようだわ…後でもう一度試してみて。")
        except Exception as notify_error:
            print(f"LINE通知エラー: {str(notify_error)}")
        
        return {
            "status": "failure",
            "error_message": str(e)
        }
    
    finally:
        # 8. 一時ファイルを削除
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
                print(f"一時ファイル削除: {temp_path}")
            except Exception as cleanup_error:
                print(f"一時ファイル削除エラー: {str(cleanup_error)}")


def call_dify_api(scores, user_id):
    """
    Dify APIを呼び出してAIKAのセリフを生成
    
    Args:
        scores: 解析スコア（dict）
        user_id: ユーザーID
        
    Returns:
        str: AIKAのセリフ（エラー時はNone）
    """
    if not DIFY_API_ENDPOINT or not DIFY_API_KEY:
        print("⚠️ Dify API設定がありません")
        return None
    
    try:
        # Dify APIリクエスト
        headers = {
            'Authorization': f'Bearer {DIFY_API_KEY}',
            'Content-Type': 'application/json'
        }
        
        payload = {
            'inputs': {
                'punch_speed_score': scores.get('punch_speed', 0),
                'guard_stability_score': scores.get('guard_stability', 0),
                'kick_height_score': scores.get('kick_height', 0),
                'core_rotation_score': scores.get('core_rotation', 0)
            },
            'response_mode': 'blocking',
            'user': user_id
        }
        
        print(f"Dify API呼び出し: {DIFY_API_ENDPOINT}")
        response = requests.post(
            DIFY_API_ENDPOINT,
            headers=headers,
            json=payload,
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            # Difyのレスポンス形式に応じて調整
            message = result.get('answer', result.get('text', result.get('message', '')))
            print(f"Dify API成功: {message[:100]}...")
            return message
        else:
            print(f"Dify APIエラー: {response.status_code} - {response.text}")
            return None
            
    except Exception as e:
        print(f"Dify API呼び出しエラー: {str(e)}")
        import traceback
        traceback.print_exc()
        return None


def send_line_message(user_id, message):
    """
    LINE Messaging APIでメッセージを送信
    
    Args:
        user_id: LINEユーザーID
        message: 送信するメッセージ
    """
    if not LINE_CHANNEL_ACCESS_TOKEN:
        print("⚠️ LINE Channel Access Tokenが設定されていません")
        return
    
    try:
        url = 'https://api.line.me/v2/bot/message/push'
        headers = {
            'Authorization': f'Bearer {LINE_CHANNEL_ACCESS_TOKEN}',
            'Content-Type': 'application/json'
        }
        
        payload = {
            'to': user_id,
            'messages': [
                {
                    'type': 'text',
                    'text': message
                }
            ]
        }
        
        print(f"LINE API呼び出し: ユーザー {user_id}")
        response = requests.post(url, headers=headers, json=payload, timeout=10)
        
        if response.status_code == 200:
            print("✅ LINEメッセージ送信成功")
        else:
            print(f"❌ LINE APIエラー: {response.status_code} - {response.text}")
            
    except Exception as e:
        print(f"LINE API呼び出しエラー: {str(e)}")
        import traceback
        traceback.print_exc()


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
                # JSON文字列の場合
                try:
                    event_data = json.loads(event_data)
                except json.JSONDecodeError:
                    print("⚠️ CloudEventデータのパースに失敗しました")
                    event_data = {}
        
        # process_video関数を呼び出し
        return process_video(event_data, None)


# テスト用（ローカル実行時）
if __name__ == '__main__':
    # テストデータ
    test_data = {
        'name': 'videos/test_user/1234567890-test.mp4',
        'bucket': 'aikaapp-584fa.appspot.com'
    }
    
    result = process_video(test_data, None)
    print(json.dumps(result, indent=2, ensure_ascii=False))
