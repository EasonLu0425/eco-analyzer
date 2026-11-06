#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if npx tsx scripts/check-missing-monthly.ts; then
  exit 0
fi

echo "[cron-eco-monthly] $(date -Iseconds) running /eco-monthly"
claude -p "/eco-monthly" --allowedTools "Bash Read Write Edit Glob Grep WebSearch"
