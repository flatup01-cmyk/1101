"""
レートリミット機能
ユーザーごとのリクエスト数を制限して、API悪用やリソース枯渇を防止
"""

from datetime import datetime, timedelta
from google.cloud import firestore

# Firestoreクライアント
db = firestore.Client()

# レートリミット設定
RATE_LIMIT_CONFIG = {
    'upload_video': {
        'max_requests': 10,  # 1日あたりの最大アップロード数
        'window_seconds': 86400,  # 24時間（秒）
        'short_window_requests': 3,  # 短時間ウィンドウ（1時間）での最大数
        'short_window_seconds': 3600,  # 1時間（秒）
    }
}


def check_rate_limit(user_id: str, action: str = 'upload_video'):
    """
    レートリミットをチェック
    
    Args:
        user_id: ユーザーID
        action: アクション名（デフォルト: 'upload_video'）
        
    Returns:
        tuple: (is_allowed: bool, message: str) 許可されるか、メッセージ
    """
    if action not in RATE_LIMIT_CONFIG:
        return True, "OK"
    
    config = RATE_LIMIT_CONFIG[action]
    now = datetime.utcnow()
    
    # Firestoreコレクション参照
    rate_limit_ref = db.collection('rate_limits').document(f"{user_id}_{action}")
    
    try:
        doc = rate_limit_ref.get()
        
        if not doc.exists:
            # 初回リクエスト → 許可
            _update_rate_limit(rate_limit_ref, now)
            return True, "OK"
        
        data = doc.to_dict()
        request_times = data.get('request_times', [])
        
        # 古い記録を削除（24時間以上前）
        cutoff_time = now - timedelta(seconds=config['window_seconds'])
        recent_requests = [
            datetime.fromisoformat(rt) 
            for rt in request_times 
            if datetime.fromisoformat(rt) > cutoff_time
        ]
        
        # 24時間ウィンドウのチェック
        if len(recent_requests) >= config['max_requests']:
            oldest_request = min(recent_requests)
            next_available = oldest_request + timedelta(seconds=config['window_seconds'])
            hours_left = (next_available - now).total_seconds() / 3600
            return False, f"1日のアップロード上限（{config['max_requests']}回）に達しました。約{hours_left:.1f}時間後に再試行できます。"
        
        # 短時間ウィンドウ（1時間）のチェック
        short_cutoff = now - timedelta(seconds=config['short_window_seconds'])
        short_recent = [rt for rt in recent_requests if rt > short_cutoff]
        
        if len(short_recent) >= config['short_window_requests']:
            oldest_short = min(short_recent)
            next_available = oldest_short + timedelta(seconds=config['short_window_seconds'])
            minutes_left = (next_available - now).total_seconds() / 60
            return False, f"短時間での連続アップロードが多すぎます。約{minutes_left:.0f}分後に再試行できます。"
        
        # リクエストを記録
        recent_requests.append(now)
        _update_rate_limit(rate_limit_ref, now, recent_requests)
        
        return True, "OK"
        
    except Exception as e:
        # エラー時は許可（サービス可用性を優先、ただしログに記録）
        print(f"⚠️ レートリミットチェックエラー: {str(e)}")
        return True, "OK (rate limit check failed)"


def _update_rate_limit(ref, now: datetime, request_times: list = None):
    """
    レートリミット記録を更新
    """
    if request_times is None:
        request_times = [now]
    
    ref.set({
        'user_id': ref.id.split('_')[0],
        'action': ref.id.split('_', 1)[1] if '_' in ref.id else 'unknown',
        'request_times': [rt.isoformat() if isinstance(rt, datetime) else rt for rt in request_times],
        'last_updated': now.isoformat(),
        'total_requests': len(request_times)
    }, merge=True)

