#!/usr/bin/env bash
# Intraday (midday) / after-close analysis. Usage: cron-eco-session.sh <midday|close>
set -euo pipefail
cd "$(dirname "$0")/.."

SESSION="${1:?usage: cron-eco-session.sh <midday|close>}"

if npx tsx scripts/check-session.ts "$SESSION"; then
  exit 0
fi

# Save the latest quotes first; also tells us whether Taiwan traded today (exit 2 = holiday -> skip Claude).
set +e
npx tsx scripts/fetch-intraday.ts "--session=$SESSION"
rc=$?
set -e
if [ "$rc" -eq 2 ]; then
  echo "[cron-eco-session] $(date -Iseconds) 今日台股休市，略過 $SESSION"
  exit 0
fi
if [ "$rc" -ne 0 ]; then
  echo "[cron-eco-session] $(date -Iseconds) 報價抓取失敗 (exit $rc)，稍後重試"
  exit 1
fi

echo "[cron-eco-session] $(date -Iseconds) running /eco-analyze $SESSION"
claude -p "/eco-analyze $SESSION" --allowedTools "Bash Read Write Edit Glob Grep WebSearch"
