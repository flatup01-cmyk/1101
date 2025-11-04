"""
Google Cloud認証ユーティリティ

指示書に従い、Google Cloudクライアントの認証を統一管理するためのユーティリティ。
将来的にVideo Intelligence API等を使用する場合に備えて、認証方式を統一化。
"""

import os
import json
import logging
from typing import Optional, List
from google.auth import default
from google.auth.transport.requests import Request
from google.oauth2 import service_account
from google.auth.exceptions import DefaultCredentialsError

logger = logging.getLogger(__name__)


def get_auth_client_from_env(scopes: Optional[List[str]] = None) -> Optional[object]:
    """
    Google Cloud認証クライアントを環境変数から取得
    
    指示書に従い、GoogleAuth({credentials: json, scopes}).getClient()の形式で
    認証クライアントを取得する。将来的にVideo Intelligence API等で使用可能。
    
    Args:
        scopes: 必要なスコープのリスト（例: ['https://www.googleapis.com/auth/cloud-platform']）
    
    Returns:
        AuthClient: 認証クライアント、失敗時はNone
    """
    if scopes is None:
        scopes = ['https://www.googleapis.com/auth/cloud-platform']
    
    try:
        # 方法1: GOOGLE_APPLICATION_CREDENTIALS_JSON環境変数から取得（推奨）
        credentials_json_str = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS_JSON')
        if credentials_json_str:
            try:
                credentials_dict = json.loads(credentials_json_str)
                credentials = service_account.Credentials.from_service_account_info(
                    credentials_dict,
                    scopes=scopes
                )
                logger.info("✅ サービスアカウント認証取得成功（GOOGLE_APPLICATION_CREDENTIALS_JSON）")
                return credentials
            except json.JSONDecodeError as e:
                logger.error(f"❌ GOOGLE_APPLICATION_CREDENTIALS_JSONのJSON解析エラー: {e}")
                return None
            except Exception as e:
                logger.error(f"❌ サービスアカウント認証エラー: {e}")
                return None
        
        # 方法2: デフォルト認証情報を使用（Cloud Functions環境で自動的に使用可能）
        try:
            credentials, project_id = default(scopes=scopes)
            logger.info(f"✅ デフォルト認証取得成功（プロジェクト: {project_id}）")
            return credentials
        except DefaultCredentialsError:
            logger.warning("⚠️ デフォルト認証情報が見つかりません")
            logger.warning("Cloud Functions環境では自動的に認証されます")
            logger.warning("ローカル開発時はGOOGLE_APPLICATION_CREDENTIALS_JSONを設定してください")
            return None
            
    except Exception as e:
        logger.error(f"❌ 認証クライアント取得エラー: {e}")
        import traceback
        traceback.print_exc()
        return None


def validate_gcp_project_id(project_id: Optional[str] = None) -> str:
    """
    GCPプロジェクトIDを検証・取得
    
    Args:
        project_id: 指定されたプロジェクトID（Noneの場合は環境変数から取得）
    
    Returns:
        str: 検証済みプロジェクトID
    """
    if project_id:
        return project_id
    
    env_project_id = os.environ.get('GOOGLE_PROJECT_ID') or os.environ.get('GCP_PROJECT')
    if env_project_id:
        return env_project_id
    
    # デフォルト値（本番環境では環境変数が必須であるべき）
    default_project_id = 'aikaapp-584fa'
    logger.warning(f"⚠️ プロジェクトIDが環境変数に設定されていません。デフォルト値を使用: {default_project_id}")
    return default_project_id


# 将来的にVideo Intelligence APIを使用する場合の例
"""
from google.cloud import videointelligence_v1

def get_video_intelligence_client():
    credentials = get_auth_client_from_env([
        'https://www.googleapis.com/auth/cloud-platform'
    ])
    if not credentials:
        raise RuntimeError("認証クライアントの取得に失敗しました")
    
    client = videointelligence_v1.VideoIntelligenceServiceClient(
        credentials=credentials
    )
    return client
"""
