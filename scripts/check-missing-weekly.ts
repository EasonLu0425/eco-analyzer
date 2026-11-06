import { getLastWeekStart, isWeeklyReportMissing, taipeiToday } from '../lib/report-store'

// exit 0 = nothing to do (weekly exists, or no daily reports last week)
// exit 1 = last week's weekly report is missing -> caller should run /eco-weekly
if (isWeeklyReportMissing()) {
  console.log(`[check-missing-weekly] 缺上週週報（weekStart=${getLastWeekStart(taipeiToday())}）`)
  process.exit(1)
}

console.log('[check-missing-weekly] 無缺漏，略過')
process.exit(0)
