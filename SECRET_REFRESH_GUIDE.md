# DIFY_API_KEY 再保存手順（衛生チェック）

## 1. Secret Managerで再保存

```bash
# 現在のシークレットを確認（表示のみ、コピーしない）
gcloud secrets versions access latest --secret="DIFY_API_KEY" --project=aikaapp-584fa

# 新しいシークレットバージョンを作成（手入力）
# 注意: 末尾改行・空白・全角・不可視文字ゼロ
# WorkspaceのAPIキーを使用（app-で始まるアプリキーではなく、通常APIキー）
echo -n "YOUR_CLEAN_API_KEY_HERE" | gcloud secrets versions add DIFY_API_KEY --data-file=- --project=aikaapp-584fa
```

## 2. 確認

```bash
# 最新バージョンを確認（長さと先頭文字のみ）
gcloud secrets versions access latest --secret="DIFY_API_KEY" --project=aikaapp-584fa | wc -c
gcloud secrets versions access latest --secret="DIFY_API_KEY" --project=aikaapp-584fa | head -c 10
```

## 3. 再デプロイ

- processVideoJob
- process-video-trigger (Cloud Run)
