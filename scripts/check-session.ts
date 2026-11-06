import { hasReportSnapshot, taipeiToday } from '../lib/report-store'
import { parseSession } from '../lib/session'

// exit 0 = today's snapshot for this session already exists -> skip
// exit 1 = missing -> caller should run the analysis
const session = parseSession(process.argv[2])
const today = taipeiToday()

if (hasReportSnapshot(today, session)) {
  console.log(`[check-session] ${today} ${session} 已有分析，略過`)
  process.exit(0)
}

console.log(`[check-session] ${today} ${session} 尚未分析`)
process.exit(1)
