import { getLastMonth, isMonthlyReportMissing, taipeiToday } from '../lib/report-store'

// exit 0 = nothing to do (monthly exists, or no daily reports last month)
// exit 1 = last month's monthly report is missing -> caller should run /eco-monthly
if (isMonthlyReportMissing()) {
  console.log(`[check-missing-monthly] 缺上月月報（month=${getLastMonth(taipeiToday())}）`)
  process.exit(1)
}

console.log('[check-missing-monthly] 無缺漏，略過')
process.exit(0)
