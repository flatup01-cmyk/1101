import os
from datetime import datetime, timedelta
from google.cloud import firestore

db = firestore.Client()

# 設定
RATE_LIMIT_WINDOW_SECONDS = int(os.environ.get('RATE_LIMIT_WINDOW_SECONDS', '3600')) # 1時間
RATE_LIMIT_MAX_REQUESTS = int(os.environ.get('RATE_LIMIT_MAX_REQUESTS', '5')) # 1時間あたり5回

def check_rate_limit(user_id, action_type):
    """
    ユーザーのレートリミットをチェックする。
    
    Args:
        user_id (str): LINEユーザーID
        action_type (str): アクションの種類 (例: 'upload_video')
        
    Returns:
        tuple: (is_allowed, message)
    """
    
    current_time = datetime.now()
    
    # レートリミット情報を保存するコレクション
    rate_limit_ref = db.collection('rate_limits').document(user_id)
    
    transaction = db.transaction()
    
    @firestore.transactional
    def update_rate_limit_in_transaction(transaction, rate_limit_ref):
        doc = rate_limit_ref.get(transaction=transaction)
        
        requests = []
        if doc.exists:
            doc_data = doc.to_dict()
            requests = doc_data.get(action_type, [])
            
        # 古いリクエストを削除
        # タイムスタンプはFirestoreのTimestampオブジェクトなので、datetimeに変換して比較
        requests = [req for req in requests if (current_time - req.to_datetime()) < timedelta(seconds=RATE_LIMIT_WINDOW_SECONDS)]
        
        if len(requests) >= RATE_LIMIT_MAX_REQUESTS:
            return False, f"…チッ、アンタ、ちょっとやりすぎじゃない？1時間あたり${RATE_LIMIT_MAX_REQUESTS}回までよ。"
        
        requests.append(current_time)
        transaction.set(rate_limit_ref, {action_type: requests}, merge=True)
        return True, ""
        
    try:
        is_allowed, message = update_rate_limit_in_transaction(transaction, rate_limit_ref)
        return is_allowed, message
    except Exception as e:
        print(f"レートリミットチェック中にエラーが発生しました: {e}")
        # エラー時は一時的に許可する（システム障害でユーザーをブロックしないため）
        return True, ""