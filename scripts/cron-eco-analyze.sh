#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if npx tsx scripts/check-missing-dates.ts; then
  exit 0
fi

echo "[cron-eco-analyze] $(date -Iseconds) running /eco-analyze"
claude -p "/eco-analyze" --allowedTools "Bash Read Write Edit Glob Grep WebSearch"
