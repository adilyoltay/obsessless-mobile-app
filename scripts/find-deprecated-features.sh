#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$ROOT_DIR/scripts/.deprecations"
mkdir -p "$OUT_DIR"

echo "🔍 Searching for deprecated feature references..."

# Crisis Detection references (code + docs)
echo "\n📍 Crisis Detection References:" | tee "$OUT_DIR/summary.txt"
grep -RIn --line-number --binary-files=without-match \
  -e "crisis" -e "CrisisRiskLevel" -e "CrisisDetection" \
  --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=Pods \
  --include='*.ts' --include='*.tsx' --include='*.md' \
  "$ROOT_DIR" | \
  grep -v "DEPRECATED" | tee "$OUT_DIR/deprecated-crisis.txt"

# AI Chat references
echo "\n💬 AI Chat References:" | tee -a "$OUT_DIR/summary.txt"
grep -RIn --line-number --binary-files=without-match \
  -e "AIChat" -e "ai_chat" -e "AI_CHAT" -e "ai chat" \
  --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=Pods \
  --include='*.ts' --include='*.tsx' --include='*.md' \
  "$ROOT_DIR" | \
  tee "$OUT_DIR/deprecated-chat.txt"

echo "\n📊 Generating cleanup report..."
node "$ROOT_DIR/scripts/generate-cleanup-report.js" "$OUT_DIR" || true

echo "\n✅ Scan completed. Outputs in: $OUT_DIR"


