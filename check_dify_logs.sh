#!/bin/bash
# processVideoJobの詳細ログ確認スクリプト

echo "=== processVideoJobの詳細ログ確認 ==="
echo ""

echo "【1】最新のエラーログ（Dify API関連）:"
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="processvideojob" AND (severity>=ERROR OR textPayload=~"Dify\|error\|Error")' \
  --limit=10 \
  --format="table(timestamp,severity,textPayload)" \
  --project=aikaapp-584fa \
  --freshness=1h 2>/dev/null | head -20 || echo "  エラーログが見つかりません"

echo ""
echo "【2】最新のprocessVideoJobログ（全体）:"
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="processvideojob"' \
  --limit=20 \
  --format="table(timestamp,severity,textPayload)" \
  --project=aikaapp-584fa \
  --freshness=1h 2>/dev/null | head -30 || echo "  ログが見つかりません"

echo ""
echo "【3】Dify API呼び出しの詳細ログ:"
gcloud logging read 'textPayload=~"Dify\|analyzeVideoBlocking\|handleVideoJob\|processVideoJob開始\|processVideoJob成功"' \
  --limit=10 \
  --format="table(timestamp,severity,textPayload)" \
  --project=aikaapp-584fa \
  --freshness=1h 2>/dev/null | head -20 || echo "  ログが見つかりません"

echo ""
echo "【4】スタックトレース（エラー詳細）:"
gcloud logging read 'severity>=ERROR AND resource.labels.service_name="processvideojob"' \
  --limit=5 \
  --format="json" \
  --project=aikaapp-584fa \
  --freshness=1h 2>/dev/null | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    for entry in data[:3]:
        print(f\"Timestamp: {entry.get('timestamp', 'N/A')}\")
        print(f\"Severity: {entry.get('severity', 'N/A')}\")
        text = entry.get('textPayload', '')
        if text:
            print(f\"Message: {text[:500]}\")
        print('---')
except:
    print('  スタックトレースが見つかりません')
" 2>/dev/null || echo "  スタックトレースが見つかりません"

echo ""
echo "✅ ログ確認完了"
