#!/usr/bin/env python3
"""
Google Cloud Video Intelligence API と Storage API の初期化を統一
非推奨APIを排除し、GoogleAuthを使用した統一的な初期化パターンに修正
"""

import os
import re
import json
from pathlib import Path
from typing import List, Dict, Tuple

class GoogleAuthFixer:
    """Google Cloud APIの初期化を統一するクラス"""
    
    def __init__(self, project_root: str):
        self.project_root = Path(project_root)
        self.fixes_applied = []
        self.errors = []
        
    def find_python_files(self) -> List[Path]:
        """Pythonファイルを再帰的に検索"""
        python_files = []
        ignore_dirs = {'node_modules', '.git', '__pycache__', '.venv', 'venv', 'dist', '.next'}
        
        for root, dirs, files in os.walk(self.project_root):
            # 無視するディレクトリを除外
            dirs[:] = [d for d in dirs if d not in ignore_dirs]
            
            for file in files:
                if file.endswith('.py'):
                    python_files.append(Path(root) / file)
        
        return python_files
    
    def check_video_intelligence_client(self, file_path: Path) -> List[Tuple[int, str]]:
        """VideoIntelligenceServiceClientの初期化パターンをチェック"""
        issues = []
        
        try:
            content = file_path.read_text(encoding='utf-8')
            lines = content.split('\n')
            
            for i, line in enumerate(lines, 1):
                # 非推奨パターン: VideoIntelligenceServiceClient({credentials: ...})
                if re.search(r'VideoIntelligenceServiceClient\s*\(\s*\{[^}]*credentials\s*:', line):
                    issues.append((i, line.strip()))
                # 推奨パターンが使用されているかチェック
                elif 'VideoIntelligenceServiceClient' in line and 'auth=' in line:
                    # 推奨パターンが使用されている可能性
                    pass
        
        except Exception as e:
            self.errors.append(f"ファイル読み込みエラー {file_path}: {e}")
        
        return issues
    
    def check_storage_client(self, file_path: Path) -> List[Tuple[int, str]]:
        """StorageClientの初期化パターンをチェック"""
        issues = []
        
        try:
            content = file_path.read_text(encoding='utf-8')
            lines = content.split('\n')
            
            for i, line in enumerate(lines, 1):
                # 非推奨パターン: StorageClient({credentials: ...})
                if re.search(r'StorageClient\s*\(\s*\{[^}]*credentials\s*:', line):
                    issues.append((i, line.strip()))
                # 推奨パターンが使用されているかチェック
                elif 'StorageClient' in line and 'auth=' in line:
                    # 推奨パターンが使用されている可能性
                    pass
        
        except Exception as e:
            self.errors.append(f"ファイル読み込みエラー {file_path}: {e}")
        
        return issues
    
    def create_auth_utility(self) -> str:
        """GoogleAuth初期化ユーティリティを生成"""
        utility_code = '''"""
Google Cloud認証ユーティリティ
統一的なAuthClient取得を提供
"""

import os
import json
from typing import Optional, List
from google.auth import default as default_credentials
from google.auth.transport.requests import Request
from google.oauth2 import service_account
from google.auth.transport.requests import AuthorizedSession


def get_auth_client_from_env(scopes: Optional[List[str]] = None) -> AuthorizedSession:
    """
    環境変数からGoogleAuthクライアントを取得
    
    Args:
        scopes: 必要なスコープのリスト（例: ['https://www.googleapis.com/auth/cloud-platform']）
    
    Returns:
        AuthorizedSession: 認証済みセッション
    """
    if scopes is None:
        scopes = ['https://www.googleapis.com/auth/cloud-platform']
    
    # 環境変数からサービスアカウントJSONを取得
    credentials_json_str = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS_JSON')
    project_id = os.environ.get('GOOGLE_PROJECT_ID')
    
    if not credentials_json_str:
        # 環境変数がない場合はデフォルト認証を使用
        credentials, project = default_credentials(scopes=scopes)
        return AuthorizedSession(credentials)
    
    # JSON文字列をパース
    try:
        credentials_dict = json.loads(credentials_json_str)
        
        # サービスアカウント認証情報を作成
        credentials = service_account.Credentials.from_service_account_info(
            credentials_dict,
            scopes=scopes
        )
        
        # 認証済みセッションを返す
        return AuthorizedSession(credentials)
    
    except json.JSONDecodeError as e:
        raise ValueError(f"GOOGLE_APPLICATION_CREDENTIALS_JSONのパースに失敗しました: {e}")
    except Exception as e:
        raise ValueError(f"認証情報の作成に失敗しました: {e}")


def get_video_intelligence_client():
    """
    VideoIntelligenceServiceClientを取得（統一的な初期化）
    
    Returns:
        VideoIntelligenceServiceClient: 初期化済みクライアント
    """
    from google.cloud import videointelligence_v1
    
    # 認証情報を取得
    auth_session = get_auth_client_from_env([
        'https://www.googleapis.com/auth/cloud-platform'
    ])
    
    # クライアントを初期化（authパラメータを使用）
    client = videointelligence_v1.VideoIntelligenceServiceClient(
        credentials=auth_session.credentials
    )
    
    return client


def get_storage_client():
    """
    StorageClientを取得（統一的な初期化）
    
    Returns:
        StorageClient: 初期化済みクライアント
    """
    from google.cloud import storage
    
    # 認証情報を取得
    auth_session = get_auth_client_from_env([
        'https://www.googleapis.com/auth/cloud-platform'
    ])
    
    # クライアントを初期化（authパラメータを使用）
    client = storage.Client(
        credentials=auth_session.credentials
    )
    
    return client
'''
        return utility_code
    
    def scan_and_fix(self):
        """すべてのファイルをスキャンして問題を報告"""
        python_files = self.find_python_files()
        
        print(f"\n{'='*60}")
        print("Google Cloud API初期化パターンのチェック")
        print(f"{'='*60}\n")
        
        video_issues = []
        storage_issues = []
        
        for file_path in python_files:
            # VideoIntelligenceServiceClientのチェック
            vi_issues = self.check_video_intelligence_client(file_path)
            if vi_issues:
                video_issues.append((file_path, vi_issues))
            
            # StorageClientのチェック
            st_issues = self.check_storage_client(file_path)
            if st_issues:
                storage_issues.append((file_path, st_issues))
        
        # 結果を表示
        if video_issues:
            print("\n⚠️  VideoIntelligenceServiceClientの非推奨パターンが見つかりました:")
            for file_path, issues in video_issues:
                print(f"  {file_path}:")
                for line_num, line_content in issues:
                    print(f"    Line {line_num}: {line_content}")
        else:
            print("✅ VideoIntelligenceServiceClientの非推奨パターンは見つかりませんでした")
        
        if storage_issues:
            print("\n⚠️  StorageClientの非推奨パターンが見つかりました:")
            for file_path, issues in storage_issues:
                print(f"  {file_path}:")
                for line_num, line_content in issues:
                    print(f"    Line {line_num}: {line_content}")
        else:
            print("✅ StorageClientの非推奨パターンは見つかりませんでした")
        
        # ユーティリティファイルを生成
        utility_path = self.project_root / 'src' / 'lib' / 'gcloud.py'
        if not utility_path.exists():
            utility_path.parent.mkdir(parents=True, exist_ok=True)
            utility_path.write_text(self.create_auth_utility(), encoding='utf-8')
            print(f"\n✅ 認証ユーティリティを作成しました: {utility_path}")
        else:
            print(f"\n⚠️  認証ユーティリティは既に存在します: {utility_path}")
        
        # エラーがあれば表示
        if self.errors:
            print("\n❌ エラー:")
            for error in self.errors:
                print(f"  {error}")
        
        return len(video_issues) == 0 and len(storage_issues) == 0


def main():
    """メイン実行"""
    project_root = os.getcwd()
    fixer = GoogleAuthFixer(project_root)
    success = fixer.scan_and_fix()
    
    if success:
        print("\n✅ すべてのチェックが成功しました")
        return 0
    else:
        print("\n⚠️  修正が必要な箇所が見つかりました")
        return 1


if __name__ == '__main__':
    exit(main())

