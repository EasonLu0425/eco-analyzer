#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if npx tsx scripts/check-missing-weekly.ts; then
  exit 0
fi

echo "[cron-eco-weekly] $(date -Iseconds) running /eco-weekly"
claude -p "/eco-weekly" --allowedTools "Bash Read Write Edit Glob Grep WebSearch"
