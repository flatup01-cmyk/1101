"""
Firebase Storage自動削除機能

容量が2.5GB（無料枠5GBの半分）を超えた場合、
古い動画から順に削除して2.5GB以下に保ちます。

定期実行: Cloud Schedulerで1日1回実行
"""

import os
from datetime import datetime, timedelta
from google.cloud import storage
from gcloud_auth import get_storage_client_with_auth, validate_gcp_project_id

# Cloud Storageクライアント
# 指示書に従い、認証ユーティリティを使用してクライアントを初期化
storage_client = None

def get_storage_client():
    """Storageクライアントを取得（遅延初期化）"""
    global storage_client
    if storage_client is None:
        storage_client = get_storage_client_with_auth()
    return storage_client

# 設定
# バケット名をフロントエンドと統一（新しいFirebase Storage形式）
BUCKET_NAME = os.environ.get('STORAGE_BUCKET', 'aikaapp-584fa.firebasestorage.app')
STORAGE_LIMIT_MB = float(os.environ.get('STORAGE_LIMIT_MB', '2560'))  # 2.5GB = 2,560MB（デフォルト）
DELETE_AGE_DAYS = int(os.environ.get('DELETE_AGE_DAYS', '30'))  # 30日以上経過した動画も削除（デフォルト）


def cleanup_old_videos(request):
    """
    Cloud SchedulerまたはHTTPトリガーで呼ばれる関数
    
    Args:
        request: Flask Request オブジェクト（HTTPトリガーの場合）
    
    Returns:
        dict: 削除結果
    """
    print("🧹 Storage自動削除処理を開始します...")
    
    # 指示書に従い、認証ユーティリティを使用してクライアントを取得
    client = get_storage_client()
    bucket = client.bucket(BUCKET_NAME)
    
    # videos/フォルダ内のすべてのファイルを取得
    blobs = list(bucket.list_blobs(prefix='videos/'))
    
    if not blobs:
        print("✅ 削除対象の動画ファイルはありません")
        return {
            "status": "success",
            "message": "削除対象なし",
            "total_size_mb": 0,
            "deleted_count": 0
        }
    
    # 現在の使用量を計算
    total_size = sum(blob.size for blob in blobs)
    total_size_mb = total_size / (1024 * 1024)
    
    print(f"📊 現在のStorage使用量: {total_size_mb:.2f}MB")
    print(f"📊 制限値: {STORAGE_LIMIT_MB}MB")
    
    # ファイル情報を取得（パス、サイズ、作成日時）
    video_files = []
    for blob in blobs:
        if not blob.name.endswith(('.mp4', '.mov', '.avi', '.mkv')):
            continue
        
        video_files.append({
            'name': blob.name,
            'size': blob.size,
            'created': blob.time_created or datetime.now(),
            'blob': blob
        })
    
    # 作成日時でソート（古い順）
    video_files.sort(key=lambda x: x['created'])
    
    deleted_count = 0
    deleted_size = 0
    
    # 削除対象を決定
    files_to_delete = []
    
    # 方法1: 30日以上経過した動画を削除
    cutoff_date = datetime.now() - timedelta(days=DELETE_AGE_DAYS)
    cutoff_date = cutoff_date.replace(tzinfo=None) if cutoff_date.tzinfo else cutoff_date
    
    for file_info in video_files:
        file_created = file_info['created']
        if file_created.tzinfo:
            file_created = file_created.replace(tzinfo=None)
        
        # 30日以上経過した動画は削除対象
        if file_created < cutoff_date:
            files_to_delete.append(file_info)
            print(f"🗑️  削除予定（30日経過）: {file_info['name']} ({file_info['size'] / 1024 / 1024:.2f}MB, {file_created})")
    
    # 方法2: 容量が制限を超えている場合、古い動画から順に削除
    current_size_mb = total_size_mb
    if current_size_mb > STORAGE_LIMIT_MB:
        remaining_to_delete = (current_size_mb - STORAGE_LIMIT_MB) * 1024 * 1024  # バイト単位
        
        for file_info in video_files:
            # 既に削除対象リストにある場合はスキップ
            if file_info in files_to_delete:
                continue
            
            # 容量が制限以下になるまで削除
            if remaining_to_delete > 0:
                files_to_delete.append(file_info)
                remaining_to_delete -= file_info['size']
                print(f"🗑️  削除予定（容量超過））: {file_info['name']} ({file_info['size'] / 1024 / 1024:.2f}MB)")
            else:
                break
    
    # ファイルを削除
    for file_info in files_to_delete:
        try:
            blob = file_info['blob']
            blob.delete()
            deleted_count += 1
            deleted_size += file_info['size']
            print(f"✅ 削除完了: {file_info['name']}")
        except Exception as e:
            print(f"❌ 削除エラー: {file_info['name']} - {str(e)}")
    
    # 削除後の使用量を再計算
    remaining_blobs = list(bucket.list_blobs(prefix='videos/'))
    remaining_size = sum(blob.size for blob in remaining_blobs)
    remaining_size_mb = remaining_size / (1024 * 1024)
    
    result = {
        "status": "success",
        "message": f"{deleted_count}個の動画を削除しました",
        "initial_size_mb": round(total_size_mb, 2),
        "remaining_size_mb": round(remaining_size_mb, 2),
        "deleted_count": deleted_count,
        "deleted_size_mb": round(deleted_size / (1024 * 1024), 2),
        "storage_limit_mb": STORAGE_LIMIT_MB
    }
    
    print(f"✅ 削除処理完了:")
    print(f"   - 削除前: {total_size_mb:.2f}MB")
    print(f"   - 削除後: {remaining_size_mb:.2f}MB")
    print(f"   - 削除数: {deleted_count}個")
    print(f"   - 削除容量: {deleted_size / 1024 / 1024:.2f}MB")
    
    return result


# Firebase Functions Framework対応
try:
    import functions_framework
    
    @functions_framework.http
    def cleanup_storage_http(request):
        """
        HTTPトリガー版（手動実行やCloud Schedulerから呼び出し可能）
        """
        return cleanup_old_videos(request)
    
    @functions_framework.cloud_event
    def cleanup_storage_scheduled(cloud_event):
        """
        Cloud Schedulerから呼び出される版
        """
        return cleanup_old_videos(None)

except ImportError:
    # ローカル開発時はスキップ
    pass


# テスト用（ローカル実行時）
if __name__ == '__main__':
    result = cleanup_old_videos(None)
    import json
    print(json.dumps(result, indent=2, ensure_ascii=False))

