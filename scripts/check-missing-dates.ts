import { getMissingReportDates } from '../lib/report-store'

const MAX_BACKFILL_DAYS = 14

const missing = getMissingReportDates(MAX_BACKFILL_DAYS)

if (missing.length === 0) {
  console.log('[check-missing-dates] 無缺漏，略過')
  process.exit(0)
} else {
  console.log(`[check-missing-dates] 缺漏 ${missing.length} 天：${missing.join(', ')}`)
  process.exit(1)
}
