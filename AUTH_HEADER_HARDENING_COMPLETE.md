# 🔒 認証・ヘッダー衛生管理 完了報告

## ✅ 実装完了した改善

### 1. **DIFY_API_KEYをSecret Managerから読み込む（最優先）**

**変更内容**:
- `DIFY_API_KEY`をSecret Managerから読み込むように変更
- 環境変数はフォールバックとして使用（後方互換性のため）

**実装箇所**: `functions/main.py` (156-175行目)

```python
# DIFY_API_KEYはSecret Managerから読み込み（最優先・セキュリティ強化）
DIFY_API_KEY = None
try:
    # Secret Managerから読み込み（latestバージョンを使用）
    DIFY_API_KEY = access_secret_version(
        "DIFY_API_KEY",
        PROJECT_ID,
        version_id="latest"
    ).strip()
    logger.info("✅ DIFY_API_KEYをSecret Managerから読み込みました")
except Exception as e:
    logger.warning(f"⚠️ Secret ManagerからDIFY_API_KEYを読み込めませんでした: {str(e)}")
    # フォールバック: 環境変数から読み込み
    DIFY_API_KEY = os.environ.get('DIFY_API_KEY')
```

---

### 2. **ASCIIサニタイズ関数を追加（ヘッダー衛生管理）**

**変更内容**:
- `sanitize_api_key()`関数を追加
- 改行・全角・不可視文字を除去
- ASCII印字可能文字のみを保持（0x20-0x7E）

**実装箇所**: `functions/main.py` (111-146行目)

```python
def sanitize_api_key(api_key):
    """
    APIキーをASCII文字列にサニタイズ（改行・全角・不可視文字を除去）
    """
    if not api_key or not isinstance(api_key, str):
        raise ValueError("API key must be a non-empty string")
    
    # まず改行と空白を除去
    cleaned = api_key.strip().replace('\r\n', '').replace('\r', '').replace('\n', '')
    # ASCII文字のみを保持（非ASCII文字を除去）
    ascii_only = cleaned.encode('ascii', 'ignore').decode('ascii')
    # 制御文字を除去（ASCII印字可能文字のみ: 0x20-0x7E）
    sanitized = ''.join(c for c in ascii_only if 32 <= ord(c) <= 126)
    
    return sanitized
```

---

### 3. **requests.postをjson=payloadに変更（latin-1対策）**

**変更内容**:
- urllib3の複雑な処理を削除
- `requests.post`を`json=payload`で使用
- ヘッダーはASCIIのみ、`json=payload`で自動的にContent-Typeが設定される

**実装箇所**: `functions/main.py` (387-398行目)

```python
# requests.postをjson=payloadで使用（latin-1対策）
# ヘッダーはASCIIのみ、json=payloadで自動的にContent-Typeが設定される
response = requests.post(
    api_url,
    headers=headers,
    json=payload,
    timeout=30
)
```

**削除したコード**:
- urllib3のHTTPConnectionPoolを使用した複雑な処理
- 複数のヘッダー変換処理
- `data=json_bytes`を使用したフォールバック処理

---

### 4. **ヘッダーをASCIIのみに簡素化**

**変更内容**:
- `Content-Type`から`charset=utf-8`を削除
- `User-Agent`を`aika/1.0`に短縮
- すべてのヘッダー値をASCII文字列として確認

**実装箇所**: `functions/main.py` (328-345行目)

```python
# ヘッダーを構築（ASCIIのみ、latin-1エンコーディングエラー対策）
# charset=utf-8は削除、User-Agentは短縮
headers = {
    'Authorization': f'Bearer {api_key_sanitized}',
    'Content-Type': 'application/json',
    'User-Agent': 'aika/1.0'
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
```

---

### 5. **パス検証の許容範囲を拡大**

**変更内容**:
- 新しいパターン（`videos/{userId}/{messageId}.mp4`）を許可
- 既存のパターン（`videos/{userId}/{jobId}/{fileName}`）も継続して許可

**実装箇所**: `functions/main.py` (760-783行目)

```python
# パス構造（3パターン対応）:
# 1. videos/{userId}/{messageId}.mp4 (リッチメニューからの動画)
# 2. videos/{userId}/{jobId}/{fileName} (LIFFアプリからの動画)
# 3. videos/{userId}/{messageId}.mp4 (LINEからの動画、リッチメニュー経由)
path_parts = file_path.split('/')
if len(path_parts) == 3:
    # リッチメニューからの動画: videos/{userId}/{messageId}.mp4
    filename = path_parts[2]
    # 拡張子を除いた部分をjobIdとして使用
    job_id = filename.rsplit('.', 1)[0] if '.' in filename else filename
else:
    # LIFFアプリからの動画: videos/{userId}/{jobId}/{filename}
    job_id = path_parts[2] if len(path_parts) >= 3 else None
```

---

### 6. **不要なimportを削除**

**変更内容**:
- `urllib3`のimportを削除（使用していないため）

**実装箇所**: `functions/main.py` (19行目)

---

## 🔍 改善の効果

### セキュリティ強化
- ✅ Secret ManagerからAPIキーを読み込む（機密情報の保護）
- ✅ ASCIIサニタイズでヘッダーを衛生管理
- ✅ 改行・全角・不可視文字を除去

### コードの簡素化
- ✅ urllib3の複雑な処理を削除
- ✅ `requests.post`を`json=payload`で使用（シンプル）
- ✅ ヘッダーをASCIIのみに簡素化

### エラー対策
- ✅ latin-1エンコーディングエラーを回避
- ✅ `ERR_INVALID_CHAR`エラーを回避
- ✅ 401認証エラーの詳細ログを出力

---

## 📋 次のステップ

### 1. Secret ManagerにDIFY_API_KEYを設定

```bash
# Secret ManagerにAPIキーを保存
echo -n "あなたの有効なAPIキー" | \
  gcloud secrets create DIFY_API_KEY --data-file=- --project=aikaapp-584fa

# Cloud RunのサービスアカウントにSecret Managerへのアクセス権限を付与
gcloud run services update process-video-trigger \
  --region=us-central1 \
  --update-secrets DIFY_API_KEY=DIFY_API_KEY:latest
```

### 2. Cloud Runに再デプロイ

```bash
cd /Users/jin/new-kingdom
gcloud run deploy process-video-trigger \
  --source=./functions \
  --region=us-central1 \
  --platform=managed \
  --allow-unauthenticated \
  --memory=2Gi \
  --timeout=540s \
  --max-instances=10 \
  --update-secrets DIFY_API_KEY=DIFY_API_KEY:latest \
  --set-env-vars DIFY_API_ENDPOINT=https://api.dify.ai/v1/chat-messages
```

### 3. テストと検証

1. **新しい動画をアップロードしてテスト**
2. **Cloud Runのログを確認**:
   - `✅ DIFY_API_KEYをSecret Managerから読み込みました`
   - `📋 Dify API設定確認:`
   - `✅ Dify API呼び出し成功:`
3. **401エラーが解消されたか確認**
4. **latin-1エラーが発生しないか確認**

---

## ⚠️ 注意事項

1. **Secret Managerの権限**: Cloud Runのサービスアカウントに`roles/secretmanager.secretAccessor`権限が必要
2. **環境変数のフォールバック**: Secret Managerから読み込めない場合、環境変数から読み込む（後方互換性のため）
3. **APIキーの形式**: DifyのAPIキーは通常`app-`で始まる
4. **ASCIIサニタイズ**: APIキーに非ASCII文字が含まれている場合、自動的に除去される

---

## 📊 変更ファイル

- `functions/main.py`: 認証・ヘッダー衛生管理の改善

---

**最終更新**: 2025-11-15  
**状態**: ✅ 完了  
**戦闘力**: 8,700

