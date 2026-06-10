import type { WeeklyReport } from '@/types'
import { getWeeklyReports } from '@/lib/report-store'

const SIG: Record<string, { label: string; colorClass: string }> = {
  'strong-buy':   { label: '強力買進', colorClass: 'text-buy' },
  'buy':          { label: '建議買進', colorClass: 'text-buy' },
  'hold':         { label: '觀望',    colorClass: 'text-hold' },
  'avoid':        { label: '避開',    colorClass: 'text-avoid' },
  'strong-avoid': { label: '強烈避開', colorClass: 'text-avoid' },
}


function ChangeChip({ pct }: { pct: number }) {
  const pos = pct >= 0
  return (
    <span className={`font-mono text-xs ${pos ? 'text-buy' : 'text-avoid'}`}>
      {pos ? '+' : ''}{pct.toFixed(2)}%
    </span>
  )
}

function WeekSection({ report, last }: { report: WeeklyReport; last: boolean }) {
  const sig = SIG[report.dominantSignal]
  const scoreClass = report.avgSentimentScore >= 7 ? 'text-buy' : report.avgSentimentScore >= 4 ? 'text-hold' : 'text-avoid'

  return (
    <div className={`py-8 ${last ? '' : 'border-b border-edge'}`}>
      <div className="flex items-baseline justify-between gap-4 mb-5">
        <div>
          <p className="font-mono text-xs text-ghost mb-1.5">
            {report.weekStart} — {report.weekEnd} · {report.tradingDays} 個交易日
          </p>
          <span className={`text-2xl font-semibold ${sig.colorClass}`}>{sig.label}</span>
        </div>
        <div className="text-right shrink-0">
          <span className={`font-mono text-3xl font-bold ${scoreClass}`}>{report.avgSentimentScore.toFixed(1)}</span>
          <p className="font-mono text-xs text-ghost">/10</p>
        </div>
      </div>

      {report.pricePerformance.length > 0 && (
        <div className="flex flex-wrap gap-4 mb-4">
          {report.pricePerformance.map(p => (
            <div key={p.ticker} className="flex items-center gap-2">
              <span className="font-mono text-xs text-ghost">{p.ticker}</span>
              <ChangeChip pct={p.changePct} />
            </div>
          ))}
        </div>
      )}

      <p className="text-dim text-sm leading-relaxed mb-3">{report.weeklyInsight}</p>

      {report.vsLastWeek && (
        <p className="text-ghost text-xs italic mb-4">{report.vsLastWeek}</p>
      )}

      {report.topRisks.length > 0 && (
        <ul className="space-y-1 mb-3">
          {report.topRisks.map(r => (
            <li key={r} className="text-xs text-ghost flex gap-2">
              <span className="text-avoid">—</span>{r}
            </li>
          ))}
        </ul>
      )}

      {report.keyThemes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {report.keyThemes.map(t => (
            <span key={t} className="font-mono text-xs text-ghost border border-edge px-2 py-0.5 rounded-sm">{t}</span>
          ))}
        </div>
      )}
    </div>
  )
}

export default function WeeklyPage() {
  const reports = getWeeklyReports()

  if (reports.length === 0) {
    return (
      <div>
        <h1 className="text-xl font-semibold tracking-tight mb-8">每週深度報告</h1>
        <div className="py-16 text-center space-y-2">
          <p className="text-dim text-sm">尚無週報資料</p>
          <p className="text-ghost text-xs">執行 <code className="font-mono">/eco-weekly</code> 產生</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight">每週深度報告</h1>
        <p className="font-mono text-xs text-ghost mt-1">{reports.length} 份週報</p>
      </div>
      <hr />
      {reports.map((r, i) => (
        <WeekSection key={r.id} report={r} last={i === reports.length - 1} />
      ))}
    </div>
  )
}
