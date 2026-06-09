import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { WeeklyReport } from '@/types'

const SIG: Record<string, { label: string; color: string }> = {
  'strong-buy':   { label: '強力買進', color: 'text-emerald-400' },
  'buy':          { label: '建議買進', color: 'text-emerald-400' },
  'hold':         { label: '觀望',    color: 'text-amber-400'  },
  'avoid':        { label: '避開',    color: 'text-rose-400'   },
  'strong-avoid': { label: '強烈避開', color: 'text-rose-400'  },
}

function loadWeeklyReports(): WeeklyReport[] {
  const dir = join(process.cwd(), 'data', 'weekly')
  if (!existsSync(dir)) return []
  try {
    return readdirSync(dir)
      .filter(f => f.endsWith('.json'))
      .map(f => JSON.parse(readFileSync(join(dir, f), 'utf-8')) as WeeklyReport)
      .sort((a, b) => b.weekStart.localeCompare(a.weekStart))
  } catch { return [] }
}

function ChangeChip({ pct }: { pct: number }) {
  const pos = pct >= 0
  return (
    <span className={`font-mono text-xs px-2 py-0.5 rounded-full ${pos ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>
      {pos ? '+' : ''}{pct.toFixed(2)}%
    </span>
  )
}

function WeekCard({ report }: { report: WeeklyReport }) {
  const sig = SIG[report.dominantSignal]
  const scoreColor = report.avgSentimentScore >= 7 ? '#10b981' : report.avgSentimentScore >= 4 ? '#f59e0b' : '#f43f5e'

  return (
    <Card className="bg-[#0C1221] border-white/[0.06]">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-slate-500 text-xs font-mono mb-1">{report.weekStart} — {report.weekEnd}</p>
            <span className={`text-lg font-bold ${sig.color}`}>{sig.label}</span>
          </div>
          <div className="text-right">
            <p className="text-slate-500 text-xs mb-0.5">情緒分數</p>
            <span className="text-2xl font-mono font-bold" style={{ color: scoreColor }}>
              {report.avgSentimentScore.toFixed(1)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <Badge variant="outline" className="text-slate-500 border-white/10 text-xs">{report.tradingDays} 個交易日</Badge>
          {report.keyThemes.map(t => (
            <Badge key={t} variant="outline" className="text-cyan-400 border-cyan-500/30 text-xs">{t}</Badge>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {report.pricePerformance.length > 0 && (
          <div>
            <p className="text-slate-500 text-xs mb-2">週漲跌幅</p>
            <div className="flex flex-wrap gap-3">
              {report.pricePerformance.map(p => (
                <div key={p.ticker} className="flex items-center gap-2">
                  <span className="text-slate-400 text-xs font-mono">{p.ticker}</span>
                  <ChangeChip pct={p.changePct} />
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-slate-300 text-sm leading-relaxed">{report.weeklyInsight}</p>

        {report.vsLastWeek && (
          <p className="text-slate-500 text-xs border-l-2 border-white/10 pl-3">{report.vsLastWeek}</p>
        )}

        {report.topRisks.length > 0 && (
          <div>
            <p className="text-slate-500 text-xs mb-2">主要風險</p>
            <ul className="space-y-1">
              {report.topRisks.map(r => (
                <li key={r} className="text-slate-400 text-xs flex gap-2">
                  <span className="text-rose-400 shrink-0">▸</span>{r}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function WeeklyPage() {
  const reports = loadWeeklyReports()

  if (reports.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">每週深度報告</h1>
        <div className="text-center py-24 text-slate-500">
          <p>尚無週報資料</p>
          <p className="text-xs mt-2">請在 Claude Code 執行 <code className="font-mono bg-white/5 px-1 rounded">/eco-weekly</code> 產生週報</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">每週深度報告</h1>
        <p className="text-slate-500 text-sm mt-1">共 {reports.length} 份週報</p>
      </div>
      <div className="space-y-4">
        {reports.map(r => <WeekCard key={r.id} report={r} />)}
      </div>
    </div>
  )
}
