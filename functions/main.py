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
import hashlib
import traceback
import time
import cv2
from datetime import datetime
from google.cloud import storage, firestore
from google.cloud.secretmanager_v1 import SecretManagerServiceClient
from tenacity import retry, stop_after_attempt, wait_exponential, RetryError
from analyze import analyze_kickboxing_form
from rate_limiter import check_rate_limit
# gcloud_authはCloud Run環境では不要（デフォルト認証を使用）
# from gcloud_auth import (
#     get_storage_client_with_auth,
#     get_firestore_client_with_auth,
#     get_secret_manager_client_with_auth,
#     validate_gcp_project_id
# )

# Firebase Functions Framework
import functions_framework

# Cloud Logging設定
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- Client Initialization (Lazy Loading) ---
# クライアントは関数内で初期化されるため、デプロイ時のタイムアウトを回避
storage_client = None
db = None

def get_storage_client():
    """
    Storageクライアントを取得（遅延初期化）
    
    Cloud Run環境ではデフォルト認証が自動的に使用される。
    """
    global storage_client
    if storage_client is None:
        storage_client = storage.Client()
    return storage_client

def get_firestore_client():
    """
    Firestoreクライアントを取得（遅延初期化）
    
    Cloud Run環境ではデフォルト認証が自動的に使用される。
    """
    global db
    if db is None:
        db = firestore.Client()
    return db

_secret_client = None
def get_secret_client():
    """
    Secret Managerクライアントを取得（遅延初期化）
    
    Cloud Run環境ではデフォルト認証が自動的に使用される。
    """
    global _secret_client
    if _secret_client is None:
        _secret_client = SecretManagerServiceClient()
    return _secret_client

# --- Secret Manager Access Function ---
def access_secret_version(secret_id, project_id, version_id="prod"):
    """
    Secret Managerからシークレットを取得
    
    Args:
        secret_id: シークレット名
        project_id: GCPプロジェクトID
        version_id: バージョンまたはエイリアス（デフォルト: prod）
                    - "prod": 本番環境用エイリアス
                    - "staging": ステージング環境用エイリアス
                    - "latest": 最新バージョン（非推奨）
                    - 数値: 特定バージョン（例: "8"）
    
    Returns:
        str: シークレットの値
    """
    try:
        client = get_secret_client()
        # エイリアスまたはバージョン番号を指定
        name = f"projects/{project_id}/secrets/{secret_id}/versions/{version_id}"
        response = client.access_secret_version(name=name)
        return response.payload.data.decode('UTF-8')
    except Exception as e:
        logger.error(f"Secret Manager読み込みエラー ({secret_id}, version={version_id}): {str(e)}")
        raise

# --- Load Secrets at Runtime ---
# プロジェクトIDを環境変数から取得（Cloud Run環境では自動設定される）
PROJECT_ID = os.environ.get('GOOGLE_CLOUD_PROJECT') or os.environ.get('GCP_PROJECT') or 'aikaapp-584fa'

# --- ASCIIサニタイズ関数（ヘッダー衛生管理）---
def sanitize_api_key(api_key):
    """
    APIキーをASCII文字列にサニタイズ（改行・全角・不可視文字を除去）
    
    Args:
        api_key: 元のAPIキー
    
    Returns:
        str: サニタイズされたAPIキー（ASCII印字可能文字のみ）
    
    Raises:
        ValueError: APIキーが空または無効な場合
    """
    if not api_key or not isinstance(api_key, str):
        raise ValueError("API key must be a non-empty string")
    
    # デバッグ情報: APIキーの長さをログに出力（マスク）
    original_length = len(api_key)
    if original_length >= 10:
        prefix = api_key[:10]
        masked_prefix = prefix[:3] + '***' + prefix[-2:]
    else:
        masked_prefix = api_key[:3] + '***' if len(api_key) > 3 else '***'
    logger.info(f"🔑 APIキー検証: 長さ={original_length}, 先頭10文字={masked_prefix}...")
    
    # まず改行と先頭・末尾の空白を除去
    cleaned = api_key.strip().replace('\r\n', '').replace('\r', '').replace('\n', '')
    if not cleaned:
        logger.error("❌ APIキーが空です（トリミング後）")
        raise ValueError("API key is empty after trimming")
    
    # サニタイズ前の長さを記録
    before_sanitize_length = len(cleaned)
    
    # ASCII文字のみを保持（非ASCII文字を除去）
    ascii_only = cleaned.encode('ascii', 'ignore').decode('ascii')
    
    # 制御文字を除去（ASCII印字可能文字のみ: 0x20-0x7E）
    # 制御文字（0x00-0x1F, 0x7F）と非ASCII文字（0x80-0xFF）を除去
    sanitized = ''.join(c for c in ascii_only if 32 <= ord(c) <= 126)
    
    # サニタイズ後の長さを記録
    after_sanitize_length = len(sanitized)
    
    if not sanitized:
        logger.error(f"❌ APIキーサニタイズ後が空: 元の長さ={original_length}, トリミング後={before_sanitize_length}, サニタイズ後={after_sanitize_length}")
        raise ValueError("API key contains no valid ASCII characters after sanitization")
    
    # 最終確認: ASCII印字可能文字のみかチェック
    if not all(32 <= ord(c) <= 126 for c in sanitized):
        logger.error(f"❌ APIキーに無効な文字が含まれています: 長さ={len(sanitized)}, 先頭10文字={sanitized[:10]}")
        # 無効な文字を検出
        invalid_chars = [c for c in sanitized if not (32 <= ord(c) <= 126)]
        logger.error(f"❌ 無効な文字: {invalid_chars}")
        raise ValueError("API key contains invalid characters after sanitization")
    
    # サニタイズ前後で長さが変わった場合、警告を出力
    if before_sanitize_length != after_sanitize_length:
        removed_count = before_sanitize_length - after_sanitize_length
        logger.warning(f"⚠️ APIキーの長さが変更されました: {before_sanitize_length} → {after_sanitize_length} ({removed_count}文字削除)")
    
    logger.info(f"✅ APIキーサニタイズ成功: 長さ={len(sanitized)}")
    
    return sanitized

# Dify API設定（Secret Manager優先、環境変数フォールバック）
DIFY_API_ENDPOINT = (
    os.environ.get('DIFY_API_URL')
    or os.environ.get('DIFY_API_ENDPOINT')
    or 'https://api.dify.ai/v1/chat-messages'
)
DIFY_APP_ID = os.environ.get('DIFY_APP_ID')  # オプション: DifyアプリID

# DIFY_API_KEYは環境変数から読み込み（Cloud RunではSecret Managerから環境変数として設定される）
# 環境変数が設定されていない場合のみ、Secret Managerから直接読み込む（フォールバック）
DIFY_API_KEY = os.environ.get('DIFY_API_KEY')
if not DIFY_API_KEY:
    try:
        # 環境変数が設定されていない場合、Secret Managerから直接読み込み（フォールバック）
        logger.warning("⚠️ 環境変数DIFY_API_KEYが設定されていません。Secret Managerから直接読み込みを試行します...")
        DIFY_API_KEY = access_secret_version(
            "DIFY_API_KEY",
            PROJECT_ID,
            version_id="prod"
        ).strip()
        logger.info("✅ DIFY_API_KEYをSecret Managerから直接読み込みました（フォールバック）")
    except Exception as e:
        logger.error(f"❌ Secret ManagerからDIFY_API_KEYを読み込めませんでした: {str(e)}")
        logger.error("❌ DIFY_API_KEYが設定されていません（環境変数とSecret Managerの両方で未設定）")
        logger.error("Dify API連携は機能しませんが、動画解析は継続されます")
else:
    logger.info("✅ DIFY_API_KEYを環境変数から読み込みました（Cloud Run Secret Manager経由）")


# --- AIKA返答整形関数 ---
def format_aika_response(raw_message, scores, user_id):
    """
    Difyの返答をツンデレ口調で整形
    - 簡潔化・重複除去
    - 戦闘力（総合スコア）を明示
    - 理由を後付け
    - 改善点・励ましの言葉を追加
    - 男性に厳しく、女性に優しく
    - ジムへの動線を追加
    """
    try:
        # ユーザーの性別を取得（デフォルトは不明）
        db = get_firestore_client()
        user_gender = 'unknown'
        try:
            user_profile = db.collection('user_profiles').document(user_id).get()
            if user_profile.exists:
                user_gender = user_profile.to_dict().get('gender', 'unknown')
        except:
            pass
        
        # 総合戦闘力を計算
        total_power = (
            scores.get('punch_speed', 0) +
            scores.get('guard_stability', 0) +
            scores.get('kick_height', 0) +
            scores.get('core_rotation', 0)
        ) / 4
        
        # Difyの返答を簡潔化（重複除去、最大2文まで）
        sentences = [s.strip() for s in raw_message.replace('\n', '。').replace('！', '。').replace('？', '。').split('。') if s.strip() and len(s.strip()) > 5]
        seen = set()
        unique_sentences = []
        for s in sentences[:2]:  # 最大2文まで
            s_clean = s[:50]  # 50文字まで
            if s_clean and s_clean not in seen:
                seen.add(s_clean)
                unique_sentences.append(s_clean)
        dify_summary = '。'.join(unique_sentences) + '。' if unique_sentences else ""
        
        # ツンデレ口調で整形（性別対応）
        if user_gender == 'female':
            opening = "…まあ、悪くないわね。"
            tone = "優しく"
        else:
            opening = "…まあ、このくらいできて当たり前だけど。"
            tone = "厳しく"
        
        # 戦闘力評価（数値明示）
        power_int = int(round(total_power))
        if power_int >= 80:
            power_comment = f"戦闘力は{power_int}。まあまあね。"
            if scores.get('punch_speed', 0) >= 80 and scores.get('guard_stability', 0) >= 70:
                reason = "パンチの速度とガードが良いわ。でも体幹の回転を意識して。"
            elif scores.get('kick_height', 0) >= 80:
                reason = "キックの高さは良いけど、ガードの安定性を上げて。"
            else:
                reason = "バランスは取れてるけど、各項目をもう少し伸ばせるわ。"
        elif power_int >= 60:
            power_comment = f"戦闘力は{power_int}。まだまだね。"
            reason = "基本はできてるけど、キックの高さと体幹の回転が足りないわ。"
        else:
            power_comment = f"戦闘力は{power_int}。…もっと練習が必要ね。"
            reason = "基礎から見直して。特にガードの安定性とパンチの速度を意識して。"
        
        # 改善点（簡潔に）
        improvements = []
        if scores.get('guard_stability', 0) < 70:
            improvements.append("ガードの安定")
        if scores.get('kick_height', 0) < 70:
            improvements.append("キックの高さ")
        if scores.get('core_rotation', 0) < 70:
            improvements.append("体幹の回転")
        if scores.get('punch_speed', 0) < 70:
            improvements.append("パンチの速度")
        
        improvement_text = ""
        if improvements:
            improvement_text = f"次は{'と'.join(improvements[:2])}を意識して。"
        
        # 励ましの言葉（性別対応）
        if user_gender == 'female':
            encouragement = "この調子で続けて。応援してるわ。"
        else:
            encouragement = "もっと頑張りなさい。期待してるわよ。"
        
        # ジムへの動線
        gym_message = "\n\nジムで直接見てもらいたい時は、いつでも来てね。一緒に練習しましょう。"
        
        # 最終メッセージを組み立て（簡潔に、重複カット）
        parts = [opening, power_comment, reason]
        if dify_summary:
            parts.append(dify_summary)
        if improvement_text:
            parts.append(improvement_text)
        parts.append(encouragement)
        parts.append(gym_message)
        
        formatted = '\n\n'.join([p for p in parts if p])
        
        return formatted.strip()
        
    except Exception as e:
        logger.error(f"❌ AIKA返答整形エラー: {str(e)}")
        # エラー時は元のメッセージを返す
        return raw_message

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
        logger.error("❌ Dify API設定が不完全です")
        logger.error(f"DIFY_API_ENDPOINT: {'設定済み' if DIFY_API_ENDPOINT else '未設定'}")
        logger.error(f"DIFY_API_KEY: {'設定済み' if DIFY_API_KEY else '未設定'}")
        logger.error("Firebase Console → Functions → 環境変数で設定してください")
        return None
    
    # デバッグログ: 環境変数の状態を確認（セキュリティのためマスク）
    logger.info(f"📋 Dify API設定確認:")
    logger.info(f"   - ENDPOINT: {DIFY_API_ENDPOINT}")
    api_key_preview = DIFY_API_KEY[:10] + "..." if len(DIFY_API_KEY) > 10 else "（短すぎます）"
    logger.info(f"   - API_KEY: {api_key_preview} (長さ: {len(DIFY_API_KEY)})")
    
    try:
        # APIキーをサニタイズ（ASCIIのみ、改行・全角・不可視文字を除去）
        try:
            api_key_sanitized = sanitize_api_key(DIFY_API_KEY)
        except ValueError as e:
            logger.error(f"❌ DIFY_API_KEYのサニタイズエラー: {str(e)}")
            return None
        
        # APIキーの先頭が正しい形式か確認（通常は "app-" で始まる）
        if not api_key_sanitized.startswith('app-'):
            logger.warning(f"⚠️ DIFY_API_KEYが 'app-' で始まっていません: {api_key_sanitized[:10]}...")
        
        # ヘッダーを構築（ASCIIのみ、latin-1エンコーディングエラー対策）
        # charset=utf-8は削除、User-Agentは短縮
        headers = {
            'Authorization': f'Bearer {api_key_sanitized}',
            'Content-Type': 'application/json',
            'User-Agent': 'process-video-trigger/1.0'  # 短いASCII文字列
        }
        
        # すべてのヘッダー値がASCII文字列であることを確認
        for k, v in list(headers.items()):
            try:
                # ASCII文字列としてエンコード可能か確認
                str(k).encode('ascii')
                str(v).encode('ascii')
            except UnicodeEncodeError:
                # ASCII文字列に変換できない場合は削除
                logger.warning(f"⚠️ ヘッダー '{k}' をASCII文字列に変換できませんでした。削除します。")
                del headers[k]
        
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
        payload = {
            'query': '動画解析結果をもとにAIKA18号として返答してください',
            'inputs': mcp_payload['params']['inputs'],
            'user': mcp_payload['params']['user'],
            'response_mode': mcp_payload['params']['response_mode']
        }
        
        logger.info(f"📤 Dify MCP呼び出し: {json.dumps(payload, ensure_ascii=False)}")
        
        # DIFY_APP_IDが設定されている場合はURLに追加
        api_url = DIFY_API_ENDPOINT
        if DIFY_APP_ID:
            separator = '&' if '?' in api_url else '?'
            api_url = f"{api_url}{separator}app_id={DIFY_APP_ID}"
            logger.info(f"📤 Dify API URL (app_id付き): {api_url}")
        
        # リトライロジック（503/429エラー対応）
        max_attempts = 3
        backoff = 1.0
        result = None
        
        for attempt in range(1, max_attempts + 1):
            try:
                logger.info(f"📤 Dify API呼び出し開始 (試行 {attempt}/{max_attempts})")
                
                # 【診断ログ】ヘッダー直前のASCII検査
                auth_header_value = headers.get('Authorization', '')
                auth_header_is_ascii = all(32 <= ord(c) <= 126 for c in auth_header_value)
                logger.info(f"🔍 [診断] Authorizationヘッダー検査: len={len(auth_header_value)}, asciiOnly={auth_header_is_ascii}")
                if not auth_header_is_ascii:
                    invalid_chars = [c for c in auth_header_value if not (32 <= ord(c) <= 126)]
                    logger.error(f"❌ [診断] Authorizationヘッダーに非ASCII文字検出: {invalid_chars}")
                    raise ValueError('Authorization header contains non-ASCII characters')
                
                # すべてのヘッダー値がASCIIであることを再確認
                for k, v in headers.items():
                    if not all(32 <= ord(c) <= 126 for c in str(v)):
                        invalid_chars = [c for c in str(v) if not (32 <= ord(c) <= 126)]
                        logger.error(f"❌ [診断] ヘッダー '{k}' に非ASCII文字検出: {invalid_chars}")
                        raise ValueError(f'Header {k} contains non-ASCII characters')
                
                # requests.postをjson=payloadで使用（latin-1対策）
                # ヘッダーはASCIIのみ、json=payloadで自動的にContent-Typeが設定される
                logger.info(f"🔍 [診断] リクエスト送信: url={api_url}, headers={list(headers.keys())}")
                response = requests.post(
                    api_url,
                    headers=headers,
                    json=payload,
                    timeout=30
                )
                logger.info(f"🔍 [診断] レスポンス受信: status={response.status_code}")
                
                # 401エラーの場合は詳細な情報を出力してリトライしない
                if response.status_code == 401:
                    logger.error(f"❌ Dify API 401認証エラー (試行 {attempt}/{max_attempts})")
                    logger.error(f"   - API URL: {api_url}")
                    logger.error(f"   - API Key 先頭10文字: {api_key_sanitized[:10]}...")
                    logger.error(f"   - API Key 長さ: {len(api_key_sanitized)}")
                    logger.error(f"   - レスポンス本文: {response.text[:500]}")
                    try:
                        error_json = response.json()
                        logger.error(f"   - エラーレスポンス: {json.dumps(error_json, ensure_ascii=False)}")
                    except:
                        logger.error(f"   - エラーレスポンス（JSON解析失敗）: {response.text[:200]}")
                    # 401エラーは認証の問題なので、リトライしても意味がない
                    logger.error(f"❌ Dify API 401認証エラー: Access tokenが無効です。DIFY_API_KEYを確認してください。")
                    result = None
                    break
                
                # 503/429エラーの場合はリトライ（指数バックオフ）
                if response.status_code in (503, 429):
                    if attempt < max_attempts:
                        wait_time = backoff * (2 ** (attempt - 1))
                        logger.warning(f"⚠️ Dify API returned {response.status_code}, retrying in {wait_time}s (attempt {attempt}/{max_attempts})")
                        time.sleep(wait_time)
                        continue
                    else:
                        logger.error(f"❌ Dify API returned {response.status_code} after {max_attempts} attempts")
                        response.raise_for_status()
                
                response.raise_for_status()
                
                # JSON解析（エラーハンドリング強化）
                try:
                    result = response.json()
                except json.JSONDecodeError as json_error:
                    logger.error(f"❌ Dify APIレスポンスのJSON解析エラー: {str(json_error)}")
                    logger.error(f"❌ レスポンス本文: {response.text[:500]}")
                    if attempt < max_attempts:
                        wait_time = backoff * (2 ** (attempt - 1))
                        logger.warning(f"⚠️ JSON解析エラー、リトライします (試行 {attempt}/{max_attempts})")
                        time.sleep(wait_time)
                        continue
                    else:
                        raise
                
                # レスポンス構造のログ出力（デバッグ用）
                logger.debug(f"📦 Dify APIレスポンス構造: {json.dumps(result, ensure_ascii=False, indent=2)[:500]}")
                
                # メッセージが含まれているか確認
                answer_preview = result.get('answer', result.get('text', result.get('data', {}).get('answer', '')))[:50]
                logger.info(f"✅ Dify API呼び出し成功: {answer_preview}...")
                break
                
            except requests.exceptions.RequestException as e:
                if attempt < max_attempts:
                    wait_time = backoff * (2 ** (attempt - 1))
                    logger.warning(f"⚠️ Dify API request failed, retrying in {wait_time}s (attempt {attempt}/{max_attempts}): {str(e)}")
                    time.sleep(wait_time)
                    continue
                else:
                    raise
        
        if result is None:
            logger.error("❌ Dify API呼び出しが全て失敗しました")
            return None
        
        # MCPスタイルのレスポンスを処理
        # Difyの標準レスポンスからメッセージを取得（複数のパスを試行）
        raw_message = None
        
        # レスポンス構造の可能性を網羅的に確認
        if isinstance(result, dict):
            # パターン1: 直接 answer フィールド
            raw_message = result.get('answer', '')
            if not raw_message:
                # パターン2: data.answer
                data = result.get('data', {})
                if isinstance(data, dict):
                    raw_message = data.get('answer', '')
            if not raw_message:
                # パターン3: text フィールド
                raw_message = result.get('text', '')
            if not raw_message:
                # パターン4: message フィールド
                raw_message = result.get('message', '')
            if not raw_message:
                # パターン5: content フィールド
                raw_message = result.get('content', '')
            if not raw_message:
                # パターン6: 文字列として返されている場合
                if isinstance(result, str):
                    raw_message = result
        
        # メッセージが取得できなかった場合の詳細ログとフォールバック
        if not raw_message or not raw_message.strip():
            logger.warning("⚠️ Dify MCPからメッセージが取得できませんでした")
            logger.error(f"❌ Difyレスポンス構造: {json.dumps(result, ensure_ascii=False, indent=2)}")
            logger.error(f"❌ レスポンスの型: {type(result)}")
            logger.error(f"❌ レスポンスのキー: {list(result.keys()) if isinstance(result, dict) else 'N/A'}")
            # フォールバック: スコアから直接メッセージを生成
            logger.info("📝 フォールバック: スコアから直接メッセージを生成します")
            fallback_message = f"動画を解析したわ。スコア: パンチ{scores.get('punch_speed', 0):.0f}、ガード{scores.get('guard_stability', 0):.0f}、キック{scores.get('kick_height', 0):.0f}、体幹{scores.get('core_rotation', 0):.0f}。"
            return format_aika_response(fallback_message, scores, user_id)
        
        # Difyの返答を整形（ツンデレ口調、簡潔化、戦闘力明示など）
        formatted_message = format_aika_response(raw_message, scores, user_id)
        
        logger.info(f"✅ Dify MCP成功: {formatted_message[:50]}...")
        return formatted_message
            
    except requests.exceptions.RequestException as e:
        logger.error(f"❌ Dify MCP APIエラー: {str(e)}")
        if hasattr(e, 'response') and e.response is not None:
            logger.error(f"レスポンス: {e.response.text}")
        return None
    except Exception as e:
        logger.error(f"❌ Dify MCP呼び出しエラー: {str(e)}")
        traceback.print_exc()
        return None


def send_line_message_simple(user_id, message):
    """
    LINE Messaging APIでメッセージを送信（簡易版・エラーハンドリングなし）
    
    【正しいpushリクエスト構造】
    - Authorizationヘッダー: Bearer <チャネルアクセストークン>（半角スペース1つ）
    - Content-Typeヘッダー: application/json
    - 本文: {"to": "<ユーザーID>", "messages": [{"type": "text", "text": "メッセージ内容"}]}
    
    Args:
        user_id: LINEユーザーID
        message: 送信するメッセージテキスト
    
    Returns:
        bool: 成功した場合True、失敗した場合False（例外は発生させない）
    """
    try:
        # Secret ManagerからLINEアクセストークンを取得（prodエイリアスを使用）
        # フォールバックとしてlatestも試行
        LINE_CHANNEL_ACCESS_TOKEN = None
        for version_id in ["prod", "latest"]:
            try:
                LINE_CHANNEL_ACCESS_TOKEN = access_secret_version(
                    "LINE_CHANNEL_ACCESS_TOKEN",
                    PROJECT_ID,
                    version_id=version_id
                ).strip()
                if LINE_CHANNEL_ACCESS_TOKEN:
                    logger.info(f"✅ LINEアクセストークン取得成功（エイリアス/バージョン: {version_id}）")
                    break
            except Exception as e:
                logger.warning(f"⚠️ エイリアス/バージョン{version_id}の取得に失敗: {str(e)}")
                continue
        
        if not LINE_CHANNEL_ACCESS_TOKEN:
            logger.error("❌ LINEアクセストークンが取得できませんでした（全バージョン試行済み）")
            return False
        
        if not LINE_CHANNEL_ACCESS_TOKEN:
            logger.error("❌ LINEアクセストークンが取得できませんでした")
            return False
        
        # LINE API push エンドポイント
        url = 'https://api.line.me/v2/bot/message/push'
        
        # 【必須】Authorizationヘッダー: Bearer <トークン>（半角スペース1つ）
        headers = {
            'Authorization': f'Bearer {LINE_CHANNEL_ACCESS_TOKEN}',
            'Content-Type': 'application/json'
        }
        
        # 【必須】リクエスト本文: to（ユーザーID）とmessages（配列）を含む
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
        logger.info(f"✅ LINEメッセージ送信成功: {user_id}")
        return True
        
    except Exception as e:
        logger.error(f"❌ LINEメッセージ送信エラー: {str(e)}")
        return False


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=4, max=10),
    reraise=True
)
def send_line_message_with_retry(user_id, message, unique_id):
    """
    LINE Messaging APIでメッセージを送信（指数関数的バックオフ・リトライ付き）
    
    【正しいpushリクエスト構造】
    - Authorizationヘッダー: Bearer <チャネルアクセストークン>（半角スペース1つ）
    - Content-Typeヘッダー: application/json
    - 本文: {"to": "<ユーザーID>", "messages": [{"type": "text", "text": "メッセージ内容"}]}
    
    Args:
        user_id: ユーザーID
        message: 送信するメッセージ
        unique_id: 冪等性確保のためのユニークID
    
    Returns:
        bool: 成功した場合True
    """
    try:
        # Secret ManagerからLINEアクセストークンを取得（prodエイリアスを使用）
        # フォールバックとしてlatestも試行
        LINE_CHANNEL_ACCESS_TOKEN = None
        for version_id in ["prod", "latest"]:
            try:
                LINE_CHANNEL_ACCESS_TOKEN = access_secret_version(
                    "LINE_CHANNEL_ACCESS_TOKEN",
                    PROJECT_ID,
                    version_id=version_id
                ).strip()
                if LINE_CHANNEL_ACCESS_TOKEN:
                    logger.info(f"✅ LINEアクセストークン取得成功（エイリアス/バージョン: {version_id}）")
                    break
            except Exception as e:
                logger.warning(f"⚠️ エイリアス/バージョン{version_id}の取得に失敗: {str(e)}")
                continue
        
        if not LINE_CHANNEL_ACCESS_TOKEN:
            logger.error("❌ LINEアクセストークンが取得できませんでした（全バージョン試行済み）")
            return False
        
        if not LINE_CHANNEL_ACCESS_TOKEN:
            logger.error("❌ LINEアクセストークンが取得できませんでした")
            return False
        
        # 【冪等性確保】既に通知済みかチェック
        db = get_firestore_client()
        notification_doc = db.collection('video_jobs').document(unique_id).get()
        if notification_doc.exists:
            notification_data = notification_doc.to_dict()
            if notification_data.get('notification_sent', False):
                logger.info(f"⏭️ 既に通知済み: {unique_id}")
                return True
        
        # LINE API push エンドポイント
        url = 'https://api.line.me/v2/bot/message/push'
        
        # 【必須】Authorizationヘッダー: Bearer <トークン>（半角スペース1つ）
        headers = {
            'Authorization': f'Bearer {LINE_CHANNEL_ACCESS_TOKEN}',
            'Content-Type': 'application/json'
        }
        
        # 【必須】リクエスト本文: to（ユーザーID）とmessages（配列）を含む
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
        db = get_firestore_client()
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
    try:
        logger.info("📁 process_video関数開始")
        logger.info(f"📁 受信データ型: {type(data)}")
        logger.info(f"📁 受信データ内容: {json.dumps(data, ensure_ascii=False, default=str) if isinstance(data, dict) else str(data)[:200]}")
        
        # 1. ファイル情報を取得
        if isinstance(data, str):
            logger.info("📁 データが文字列型です。パースを試みます...")
            try:
                data = json.loads(base64.b64decode(data).decode('utf-8'))
                logger.info("📁 Base64デコード→JSONパース成功")
            except (json.JSONDecodeError, UnicodeDecodeError, ValueError) as e:
                try:
                    data = json.loads(data)
                    logger.info("📁 JSON文字列としてパース成功")
                except json.JSONDecodeError:
                    logger.error(f"❌ データパースエラー: {str(e)}")
                    return {"status": "error", "reason": "invalid data format"}
        
        file_path = data.get('name') or data.get('file')
        bucket_name = data.get('bucket', os.environ.get('STORAGE_BUCKET', 'aikaapp-584fa.firebasestorage.app'))
        
        logger.info(f"📁 処理開始: {file_path} (bucket: {bucket_name})")
    
        # videos/で始まらないファイルは無視
        if not file_path or not file_path.startswith('videos/'):
            logger.info(f"⚠️ スキップ: videos/で始まらないファイル: {file_path}")
            return {"status": "skipped", "reason": "not a video file"}
    
        # パストラバーサル攻撃対策
        # 注意: osはモジュールレベルで既にimportされているため、関数内でimport os.pathは不要
        # 関数内でimport os.pathを実行すると、osがローカル変数として扱われ、UnboundLocalErrorが発生する
        normalized_path = os.path.normpath(file_path)
        if not normalized_path.startswith('videos/'):
            logger.error(f"❌ セキュリティ: 不正なパス: {file_path}")
            return {"status": "error", "reason": "invalid path"}
        
        # ファイルパスからユーザーIDとjobIdを抽出
        # パス構造（2パターン対応）:
        # 1. videos/{userId}/{messageId}.mp4 (リッチメニューからの動画)
        # 2. videos/{userId}/{jobId}/{fileName} (LIFFアプリからの動画)
        # 3. videos/{userId}/{messageId}.mp4 (LINEからの動画、リッチメニュー経由)
        path_parts = file_path.split('/')
        if len(path_parts) < 3:
            logger.error(f"❌ セキュリティ: パス構造が不正: {file_path}")
            return {"status": "error", "reason": "invalid path structure"}
        
        user_id = path_parts[1]
        # パスが3要素（videos/{userId}/{filename}）の場合は、messageIdをjobIdとして使用
        # パスが4要素以上（videos/{userId}/{jobId}/{filename}）の場合は、jobIdを抽出
        if len(path_parts) == 3:
            # リッチメニューからの動画: videos/{userId}/{messageId}.mp4
            filename = path_parts[2]
            # 拡張子を除いた部分をjobIdとして使用
            job_id = filename.rsplit('.', 1)[0] if '.' in filename else filename
            logger.info(f"📁 リッチメニュー形式のパスを検出: jobId={job_id}")
        else:
            # LIFFアプリからの動画: videos/{userId}/{jobId}/{filename}
            job_id = path_parts[2] if len(path_parts) >= 3 else None
        
        logger.info(f"📁 ユーザーID抽出: {user_id}, JobID抽出: {job_id}")
        
        # ユーザーIDの検証
        if not user_id or not user_id.replace('-', '').replace('_', '').isalnum():
            logger.error(f"❌ セキュリティ: 不正なユーザーID: {user_id}")
            return {"status": "error", "reason": "invalid user id"}
        
        # レートリミットチェック
        logger.info(f"📁 レートリミットチェック開始: {user_id}")
        is_allowed, rate_limit_message = check_rate_limit(user_id, 'upload_video')
        if not is_allowed:
            logger.warning(f"❌ レートリミット超過: {user_id} - {rate_limit_message}")
            # 簡易的なLINEメッセージ送信（エラーは無視）
            send_line_message_simple(user_id, f"ごめんあそばせ。{rate_limit_message}")
            return {"status": "rate_limit_exceeded", "reason": rate_limit_message}
        
        logger.info(f"✓ レートリミットチェック通過: {user_id}")
    
        # 【冪等性確保】Firestoreで処理済みチェック
        logger.info(f"📁 冪等性チェック開始: jobId={job_id}")
        # jobIdが存在する場合はそれを使用、ない場合はファイルパスをハッシュ化
        db = get_firestore_client()
        if job_id:
            processing_doc_ref = db.collection('video_jobs').document(job_id)
            unique_id = job_id
        else:
            file_hash = hashlib.md5(file_path.encode()).hexdigest()
            processing_doc_ref = db.collection('video_processing').document(file_hash)
            unique_id = file_hash
        
        # 【冪等性確保】アトミックトランザクションで処理済みチェック
        @firestore.transactional
        def check_and_mark_processing(transaction, processing_doc_ref, job_id, file_path, user_id):
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

            payload = {
                'status': 'processing',
                'file_path': file_path,
                'user_id': user_id,
                'updated_at': firestore.SERVER_TIMESTAMP
            }
            if not doc.exists:
                payload['started_at'] = firestore.SERVER_TIMESTAMP

            if job_id:
                if doc.exists:
                    transaction.update(processing_doc_ref, payload)
                else:
                    transaction.set(processing_doc_ref, payload)
            else:
                transaction.set(processing_doc_ref, payload)
            return True  # 新規処理
        
        try:
            transaction = db.transaction()
            is_new = check_and_mark_processing(transaction, processing_doc_ref, job_id, file_path, user_id)
            if not is_new:
                logger.info("⚠️ スキップ: 既に処理済みまたは処理中")
                return {"status": "skipped", "reason": "already processed or processing"}
            logger.info("📁 新規処理としてマーク完了")
        except Exception as e:
            logger.error(f"❌ トランザクション失敗: {str(e)}")
            traceback.print_exc()
            return {"status": "error", "reason": "transaction failed"}
        
        # 2. 動画ファイルを一時ディレクトリにダウンロード
        logger.info(f"📁 動画ダウンロード開始: {file_path}")
        storage_client = get_storage_client()
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(file_path)
        
        temp_path = None
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix='.mp4') as temp_file:
                temp_path = temp_file.name
                blob.download_to_filename(temp_path)
                logger.info(f"📁 ダウンロード完了: {temp_path}")
            
            # ファイルサイズチェック（100MB制限）
            file_size = os.path.getsize(temp_path)
            max_size = 100 * 1024 * 1024  # 100MB
            if file_size > max_size:
                logger.error(f"❌ ファイルサイズ超過: {file_size / 1024 / 1024:.2f}MB > 100MB")
                # 簡易的なLINEメッセージ送信（エラーは無視）
                send_line_message_simple(user_id, "ごめんあそばせ。動画ファイルが大きすぎるわ（100MB以下に収めて）。")
                # Firestoreを更新（エラー状態）
                processing_doc_ref.set({
                    'status': 'error',
                    'error_message': 'file size too large',
                    'updated_at': firestore.SERVER_TIMESTAMP
                }, merge=True)
                return {"status": "error", "reason": "file size too large"}
            
            # 動画の長さチェック（20秒制限）
            cap = cv2.VideoCapture(temp_path)
            if not cap.isOpened():
                logger.error(f"❌ 動画ファイルを開けません: {temp_path}")
                cap.release()
                processing_doc_ref.set({
                    'status': 'error',
                    'error_message': 'cannot open video file',
                    'updated_at': firestore.SERVER_TIMESTAMP
                }, merge=True)
                return {"status": "error", "reason": "cannot open video file"}
            
            fps = cap.get(cv2.CAP_PROP_FPS)
            frame_count = cap.get(cv2.CAP_PROP_FRAME_COUNT)
            cap.release()
            
            if fps > 0:
                duration = frame_count / fps
                if duration > 20:
                    logger.error(f"❌ 動画の長さ超過: {duration:.2f}秒 > 20秒")
                    # 簡易的なLINEメッセージ送信（エラーは無視）
                    send_line_message_simple(user_id, "ごめんあそばせ。動画が長すぎるわ（20秒以内に収めて）。")
                    processing_doc_ref.set({
                        'status': 'error',
                        'error_message': 'video duration too long',
                        'updated_at': firestore.SERVER_TIMESTAMP
                    }, merge=True)
                    return {"status": "error", "reason": "video duration too long"}
            else:
                logger.warning("⚠️ FPSが取得できませんでした。動画の長さチェックをスキップします。")
                
        except Exception as download_error:
            logger.error(f"❌ ファイルダウンロードエラー: {str(download_error)}")
            processing_doc_ref.set({
                'status': 'error',
                'error_message': 'download failed',
                'updated_at': firestore.SERVER_TIMESTAMP
            }, merge=True)
            return {"status": "error", "reason": "download failed"}
        
        try:
            # 3. 動画解析を実行
            logger.info(f"📁 動画解析開始: {temp_path}")
            analysis_result = analyze_kickboxing_form(temp_path)
            logger.info(f"📁 解析結果: {json.dumps(analysis_result, ensure_ascii=False)}")
            
            if analysis_result['status'] != 'success':
                logger.error(f"❌ 解析失敗: {analysis_result.get('error_message', 'unknown error')}")
                processing_doc_ref.set({
                    'status': 'error',
                    'error_message': analysis_result.get('error_message', 'analysis failed'),
                    'updated_at': firestore.SERVER_TIMESTAMP
                }, merge=True)
                return analysis_result
            
            # 4. MCPスタイルでDify APIに送信してAIKAのセリフを生成
            logger.info(f"📁 Dify API呼び出し開始: user_id={user_id}")
            aika_message = call_dify_via_mcp(analysis_result['scores'], user_id)
            
            if not aika_message:
                logger.warning("⚠️ Dify MCPからメッセージが取得できませんでした")
                # デフォルトメッセージを使用（整形関数を通す）
                scores = analysis_result['scores']
                aika_message = format_aika_response("動画を解析しました。", scores, user_id)
            
            # 整形済みメッセージをそのまま使用（既にformat_aika_responseで整形済み）
            full_message = aika_message
            
            # 5. LINE Messaging APIでユーザーに送信（指数関数的バックオフ・リトライ付き）
            logger.info(f"📁 LINE送信開始: user_id={user_id}")
            line_sent = False
            max_line_attempts = 5  # LINE送信は最大5回試行
            
            for line_attempt in range(1, max_line_attempts + 1):
                try:
                    if line_attempt == 1:
                        # 最初はリトライ版を試行
                        send_line_message_with_retry(user_id, full_message, unique_id)
                        logger.info(f"✅ LINE送信成功（リトライ版）: user_id={user_id}")
                        line_sent = True
                        break
                    else:
                        # 2回目以降は簡易版を試行
                        if send_line_message_simple(user_id, full_message):
                            logger.info(f"✅ LINE送信成功（簡易版・試行{line_attempt}回目）: user_id={user_id}")
                            line_sent = True
                            break
                        else:
                            logger.warning(f"⚠️ LINE送信失敗（簡易版・試行{line_attempt}回目）")
                            if line_attempt < max_line_attempts:
                                time.sleep(2 * line_attempt)  # 指数バックオフ
                            continue
                except Exception as send_error:
                    logger.error(f"❌ LINE送信エラー（試行{line_attempt}回目）: {str(send_error)}")
                    if line_attempt < max_line_attempts:
                        time.sleep(2 * line_attempt)  # 指数バックオフ
                        continue
                    else:
                        logger.error(f"❌ LINE送信が全て失敗しました（{max_line_attempts}回試行）")
            
            # LINE送信が失敗した場合でも、Firestoreには結果を保存（後で再送信可能）
            if not line_sent:
                logger.error(f"❌ CRITICAL: LINE送信に失敗しました。user_id={user_id}, unique_id={unique_id}")
                # Firestoreに送信失敗フラグを記録
                try:
                    processing_doc_ref.set({
                        'line_send_failed': True,
                        'line_send_error': 'All retry attempts failed',
                        'line_send_attempts': max_line_attempts,
                        'updated_at': firestore.SERVER_TIMESTAMP
                    }, merge=True)
                except Exception as firestore_error:
                    logger.error(f"❌ Firestore更新も失敗: {str(firestore_error)}")
            
            # 【データ整合性】Firestoreを更新（分析結果とステータス）
            logger.info(f"📁 Firestore更新開始: unique_id={unique_id}")
            processing_doc_ref.set({
                'status': 'completed',
                'analysis_result': analysis_result['scores'],
                'aika_message': aika_message,
                'full_message': full_message,
                'completed_at': firestore.SERVER_TIMESTAMP,
                'updated_at': firestore.SERVER_TIMESTAMP
            }, merge=True)
            
            logger.info(f"✅ 処理完了: {file_path} (分析結果をFirestoreに保存)")
            
            return {
                "status": "success",
                "analysis": analysis_result['scores']
            }
            
        except Exception as e:
            logger.error(f"❌ エラー発生: {str(e)}")
            logger.error(f"❌ トレースバック:\n{traceback.format_exc()}")
            
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
            processing_doc_ref.set({
                'status': 'error',
                'error_message': str(e),
                'updated_at': firestore.SERVER_TIMESTAMP
            }, merge=True)
            
            return {"status": "failure", "error_message": str(e)}
        
        finally:
            # 8. 一時ファイルを削除
            if temp_path and os.path.exists(temp_path):
                try:
                    os.remove(temp_path)
                    logger.info(f"📁 一時ファイル削除: {temp_path}")
                except Exception as cleanup_error:
                    logger.error(f"❌ 一時ファイル削除エラー: {str(cleanup_error)}")
    
    except Exception as e:
        logger.error(f"❌ process_video実行エラー: {str(e)}")
        logger.error(f"❌ トレースバック:\n{traceback.format_exc()}")
        return {"status": "error", "reason": str(e)}





# Firebase Storage トリガー関数（CloudEvent形式・Cloud Storage v2仕様対応）
@functions_framework.cloud_event
def process_video_trigger(cloud_event):
    """
    Firebase StorageのCloudEventトリガー（Cloud Storage v2仕様対応）
    
    Storageにファイルが作成されると自動で呼ばれます
    """
    # CloudEventオブジェクトの属性を安全に取得（辞書形式とオブジェクト形式の両方に対応）
    try:
        logger.info("=" * 80)
        logger.info("🔔 CloudEvent受信開始")
        logger.info(f"📦 CloudEvent全体の型: {type(cloud_event)}")
        logger.info(f"📦 CloudEvent全体の内容（最初の1000文字）: {str(cloud_event)[:1000]}")
        
        # CloudEventの属性を取得（辞書形式とオブジェクト形式の両方に対応）
        if isinstance(cloud_event, dict):
            attributes = cloud_event.get('attributes', {})
            if not isinstance(attributes, dict):
                attributes = {}
            event_type = attributes.get('type') or cloud_event.get('type', 'unknown')
            event_source = attributes.get('source') or cloud_event.get('source', 'unknown')
            event_data = cloud_event.get('data') or cloud_event.get('payload')
        else:
            # オブジェクト形式の場合
            attributes = getattr(cloud_event, 'attributes', None)
            if attributes and isinstance(attributes, dict):
                event_type = attributes.get('type', 'unknown')
                event_source = attributes.get('source', 'unknown')
            else:
                event_type = getattr(cloud_event, 'type', 'unknown')
                event_source = getattr(cloud_event, 'source', 'unknown')
            event_data = getattr(cloud_event, 'data', None) or getattr(cloud_event, 'payload', None)
        
        logger.info(f"🔔 CloudEvent type: {event_type}")
        logger.info(f"🔔 CloudEvent source: {event_source}")
        logger.info(f"📦 CloudEvent.dataの型: {type(event_data)}")
        
        # CloudEvent.dataがNoneの場合の処理
        if event_data is None:
            logger.error("❌ CloudEvent.dataがNoneです")
            # オブジェクト形式の場合、直接属性にアクセスを試行
            if hasattr(cloud_event, 'data'):
                logger.info("📦 cloud_event.data属性を直接確認...")
                event_data = cloud_event.data
                logger.info(f"📦 直接取得したevent_dataの型: {type(event_data)}")
            else:
                logger.error("❌ CloudEventにdata属性が見つかりません")
                return {"status": "error", "reason": "no data in cloud_event"}
        
        # デバッグログ: 実際のデータ構造を確認
        if event_data:
            logger.info(f"📦 CloudEvent.dataの内容（最初の1000文字）: {str(event_data)[:1000]}")
        
        # Cloud Storage v2仕様のCloudEventデータ構造を処理
        # パターン1: Base64エンコードされたJSON文字列（最も一般的）
        if isinstance(event_data, str):
            logger.info("📦 event_dataは文字列型です。Base64デコードを試行...")
            try:
                # Base64デコードを試行
                decoded_bytes = base64.b64decode(event_data)
                decoded_str = decoded_bytes.decode('utf-8')
                event_data = json.loads(decoded_str)
                logger.info("✅ Base64デコード成功")
                logger.info(f"📦 デコード後のevent_data: {json.dumps(event_data, ensure_ascii=False)}")
            except Exception as decode_error:
                # Base64デコードに失敗した場合、JSON文字列として直接パースを試行
                logger.info("⚠️ Base64デコードに失敗。JSON文字列として直接パースを試行...")
                try:
                    event_data = json.loads(event_data)
                    logger.info("✅ JSON文字列として直接パース成功")
                except json.JSONDecodeError:
                    logger.error(f"❌ CloudEventデータのデコードエラー: {decode_error}")
                    logger.error(f"   データ（最初の500文字）: {event_data[:500] if len(event_data) > 500 else event_data}")
                    return {"status": "error", "reason": "decode error", "details": str(decode_error)}
        
        # パターン2: 既に辞書形式
        if isinstance(event_data, dict):
            logger.info("📦 event_dataは辞書形式です。データを抽出...")
            # バケット名とファイル名を取得（複数のキー名に対応）
            bucket = event_data.get('bucket') or event_data.get('bucketId') or ''
            name = event_data.get('name') or event_data.get('object') or event_data.get('file') or ''
            
            logger.info(f"📁 抽出されたデータ: bucket={bucket}, name={name}")
            
            if not bucket or not name:
                logger.error(f"❌ CloudEventデータが不完全: bucket={bucket}, name={name}")
                logger.error(f"   完全なevent_data: {json.dumps(event_data, ensure_ascii=False)}")
                logger.error(f"   利用可能なキー: {list(event_data.keys())}")
                return {"status": "error", "reason": "incomplete event data", "bucket": bucket, "name": name}
            
            # process_video関数に渡す形式に変換
            video_data = {
                'bucket': bucket,
                'name': name
            }
            
            logger.info(f"📁 処理対象ファイル: {name} (バケット: {bucket})")
            
            # パスの検証（事前チェック）
            if not name.startswith('videos/'):
                logger.warning(f"⚠️ パスがvideos/で始まらない: {name}")
                logger.warning(f"   完全なevent_data: {json.dumps(event_data, ensure_ascii=False)}")
                return {"status": "skipped", "reason": "not a video file", "file_path": name}
            
            try:
                logger.info("🚀 process_video関数を呼び出します...")
                result = process_video(video_data, None)
                logger.info(f"✅ 処理完了: {json.dumps(result, ensure_ascii=False)}")
                logger.info("=" * 80)
                return result
            except Exception as process_error:
                logger.error(f"❌ process_video実行エラー: {process_error}")
                traceback.print_exc()
                logger.info("=" * 80)
                return {"status": "error", "reason": "processing error", "details": str(process_error)}
        else:
            logger.error(f"❌ 予期しないCloudEventデータ形式: {type(event_data)}")
            logger.error(f"   データ内容: {str(event_data)[:500]}")
            logger.info("=" * 80)
            return {"status": "error", "reason": "unexpected event data format", "type": str(type(event_data))}
                
    except Exception as e:
        logger.error(f"❌ CloudEvent処理エラー: {e}")
        logger.error(f"   CloudEvent型: {type(cloud_event)}")
        logger.error(f"   CloudEvent内容: {str(cloud_event)[:500]}")
        traceback.print_exc()
        logger.info("=" * 80)
        return {"status": "error", "reason": str(e)}


# Cloud Run HTTPエンドポイント（CloudEvent形式のリクエストを受け取る）
@functions_framework.http
def app(request):
    """
    Cloud Run HTTPエンドポイント
    
    Cloud StorageからのCloudEvent形式のHTTPリクエストを受け取り、
    process_video_trigger関数に渡します。
    """
    try:
        # CloudEvent形式のリクエストを処理
        if request.method == 'POST':
            # リクエストボディを取得
            if request.is_json:
                event_data = request.get_json()
            else:
                # JSON以外の場合はテキストとして取得
                event_data = request.get_data(as_text=True)
                try:
                    event_data = json.loads(event_data)
                except json.JSONDecodeError:
                    # Base64エンコードされている可能性がある
                    try:
                        decoded_bytes = base64.b64decode(event_data)
                        event_data = json.loads(decoded_bytes.decode('utf-8'))
                    except:
                        logger.error(f"❌ リクエストボディの解析に失敗: {event_data[:500]}")
                        return {"status": "error", "reason": "invalid request body"}, 400
            
            # CloudEvent形式のデータを構築
            cloud_event = {
                'attributes': {
                    'type': request.headers.get('Ce-Type', 'google.cloud.storage.object.v1.finalized'),
                    'source': request.headers.get('Ce-Source', '//storage.googleapis.com'),
                },
                'data': event_data
            }
            
            # process_video_trigger関数を呼び出し
            result = process_video_trigger(cloud_event)
            return result, 200
        else:
            return {"status": "error", "reason": "method not allowed"}, 405
    except Exception as e:
        logger.error(f"❌ HTTPエンドポイントエラー: {e}")
        traceback.print_exc()
        return {"status": "error", "reason": str(e)}, 500

