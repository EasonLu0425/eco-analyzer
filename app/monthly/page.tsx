import type { MonthlyReport } from '@/types'
import { getMonthlyReports } from '@/lib/report-store'

const SIG: Record<string, { label: string; colorClass: string }> = {
  'strong-buy':   { label: '強力買進', colorClass: 'text-buy' },
  'buy':          { label: '建議買進', colorClass: 'text-buy' },
  'hold':         { label: '觀望',    colorClass: 'text-hold' },
  'avoid':        { label: '避開',    colorClass: 'text-avoid' },
  'strong-avoid': { label: '強烈避開', colorClass: 'text-avoid' },
}

const TREND: Record<string, { label: string; colorClass: string }> = {
  improving: { label: '趨勢向好', colorClass: 'text-buy' },
  declining:  { label: '趨勢走弱', colorClass: 'text-avoid' },
  stable:     { label: '趨勢平穩', colorClass: 'text-hold' },
}


function ChangeChip({ pct }: { pct: number }) {
  const pos = pct >= 0
  return (
    <span className={`font-mono text-xs ${pos ? 'text-buy' : 'text-avoid'}`}>
      {pos ? '+' : ''}{pct.toFixed(2)}%
    </span>
  )
}

function MonthSection({ report, last }: { report: MonthlyReport; last: boolean }) {
  const sig = SIG[report.dominantSignal]
  const trend = TREND[report.sentimentTrend]
  const scoreClass = report.avgSentimentScore >= 7 ? 'text-buy' : report.avgSentimentScore >= 4 ? 'text-hold' : 'text-avoid'

  return (
    <div className={`py-8 ${last ? '' : 'border-b border-edge'}`}>
      <div className="flex items-baseline justify-between gap-4 mb-5">
        <div>
          <p className="font-mono text-xs text-ghost mb-1.5">{report.month} · {report.tradingDays} 個交易日</p>
          <div className="flex items-baseline gap-3">
            <span className={`text-2xl font-semibold ${sig.colorClass}`}>{sig.label}</span>
            <span className={`text-sm ${trend.colorClass}`}>{trend.label}</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <span className={`font-mono text-3xl font-bold ${scoreClass}`}>{report.avgSentimentScore.toFixed(1)}</span>
          <p className="font-mono text-xs text-ghost">/10</p>
        </div>
      </div>

      {report.pricePerformance.length > 0 && (
        <div className="flex flex-wrap gap-4 mb-5">
          {report.pricePerformance.map(p => (
            <div key={p.ticker} className="flex items-center gap-2">
              <span className="font-mono text-xs text-ghost">{p.ticker}</span>
              <ChangeChip pct={p.changePct} />
            </div>
          ))}
        </div>
      )}

      <p className="text-dim text-sm leading-relaxed mb-4">{report.monthlyInsight}</p>

      <div className="bg-lift rounded-sm px-4 py-3 mb-4">
        <p className="font-mono text-xs text-ghost mb-1.5">投資展望</p>
        <p className="text-dim text-sm leading-relaxed">{report.investmentOutlook}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {report.keyEvents.length > 0 && (
          <div>
            <p className="font-mono text-xs text-ghost mb-2">重大事件</p>
            <ul className="space-y-1">
              {report.keyEvents.map(e => (
                <li key={e} className="text-xs text-dim flex gap-2">
                  <span className="text-hold">—</span>{e}
                </li>
              ))}
            </ul>
          </div>
        )}
        {report.topRisks.length > 0 && (
          <div>
            <p className="font-mono text-xs text-ghost mb-2">主要風險</p>
            <ul className="space-y-1">
              {report.topRisks.map(r => (
                <li key={r} className="text-xs text-dim flex gap-2">
                  <span className="text-avoid">—</span>{r}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {report.sectorRotation.length > 0 && (
        <div className="mt-4">
          <p className="font-mono text-xs text-ghost mb-2">資金輪動</p>
          <div className="flex flex-wrap gap-2">
            {report.sectorRotation.map(s => (
              <span key={s} className="font-mono text-xs text-ghost border border-edge px-2 py-0.5 rounded-sm">{s}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function MonthlyPage() {
  const reports = getMonthlyReports()

  if (reports.length === 0) {
    return (
      <div>
        <h1 className="text-xl font-semibold tracking-tight mb-8">每月深度報告</h1>
        <div className="py-16 text-center space-y-2">
          <p className="text-dim text-sm">尚無月報資料</p>
          <p className="text-ghost text-xs">執行 <code className="font-mono">/eco-monthly</code> 產生</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight">每月深度報告</h1>
        <p className="font-mono text-xs text-ghost mt-1">{reports.length} 份月報</p>
      </div>
      <hr />
      {reports.map((r, i) => (
        <MonthSection key={r.id} report={r} last={i === reports.length - 1} />
      ))}
    </div>
  )
}
