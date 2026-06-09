import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import type { AnalysisReport } from '@/types'

const SIGNAL_CONFIG = {
  'strong-buy':  { label: '強力買進', color: 'text-emerald-400', bg: 'from-emerald-500/10 to-emerald-500/5', border: 'border-emerald-500/20', dot: 'bg-emerald-400' },
  'buy':         { label: '建議買進', color: 'text-emerald-400', bg: 'from-emerald-500/10 to-emerald-500/5', border: 'border-emerald-500/20', dot: 'bg-emerald-400' },
  'hold':        { label: '觀望',    color: 'text-amber-400',   bg: 'from-amber-500/10 to-amber-500/5',   border: 'border-amber-500/20',   dot: 'bg-amber-400' },
  'avoid':       { label: '避開',    color: 'text-rose-400',    bg: 'from-rose-500/10 to-rose-500/5',    border: 'border-rose-500/20',    dot: 'bg-rose-400' },
  'strong-avoid':{ label: '強烈避開', color: 'text-rose-400',   bg: 'from-rose-500/10 to-rose-500/5',    border: 'border-rose-500/20',    dot: 'bg-rose-400' },
} as const

async function getLatestReport(): Promise<AnalysisReport | null> {
  try {
    const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'
    const res = await fetch(`${base}/api/reports?latest=true`, { next: { revalidate: 300 } })
    const json = await res.json()
    return json.data ?? null
  } catch {
    return null
  }
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 7 ? '#10b981' : score >= 4 ? '#f59e0b' : '#f43f5e'
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="text-slate-400">情緒分數</span>
        <span className="font-mono font-semibold" style={{ color }}>{score.toFixed(1)} / 10</span>
      </div>
      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${(score / 10) * 100}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

export default async function DashboardPage() {
  const report = await getLatestReport()

  if (!report) {
    return (
      <div className="text-center py-24 space-y-3">
        <div className="text-5xl">📊</div>
        <p className="text-slate-400 text-lg">尚無分析報告</p>
        <p className="text-slate-600 text-sm">排程將於每日 08:30 自動執行，或執行 <code className="text-slate-500">pnpm analyze</code> 手動觸發</p>
      </div>
    )
  }

  const cfg = SIGNAL_CONFIG[report.signal]
  const dateLabel = new Date(report.date).toLocaleDateString('zh-TW', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-500 text-sm">{dateLabel}</p>
          <h1 className="text-2xl font-bold tracking-tight mt-0.5">今日市場分析</h1>
        </div>
        <Badge variant="outline" className="text-slate-400 border-white/10">{report.newsCount} 則新聞</Badge>
      </div>

      {/* Signal hero card */}
      <Card className={`bg-gradient-to-br ${cfg.bg} border ${cfg.border} relative overflow-hidden`}>
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
        <CardContent className="p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className={`w-3 h-3 rounded-full ${cfg.dot} animate-pulse`} />
            <span className="text-slate-400 text-sm font-medium uppercase tracking-wider">科技 ETF 訊號</span>
          </div>
          <div className={`text-5xl font-bold tracking-tight ${cfg.color} mb-6`}>{cfg.label}</div>
          <ScoreBar score={report.sentimentScore} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-[#0C1221] border-white/[0.06]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-slate-200">分析摘要</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-slate-400 text-sm leading-relaxed">{report.summary}</p>
            <Separator className="bg-white/5" />
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">風險因素</p>
              <ul className="space-y-2">
                {report.risks.map((risk, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-400">
                    <span className="text-rose-400 mt-0.5 shrink-0">▸</span>{risk}
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0C1221] border-white/[0.06]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-slate-200">今日重點新聞</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {report.topHeadlines.map((h, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="font-mono text-xs text-slate-600 mt-0.5 w-4 shrink-0">{String(i + 1).padStart(2, '0')}</span>
                  <span className="text-sm text-slate-400 leading-relaxed">{h}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>

      <p className="text-center text-xs text-slate-600">
        最後更新：{new Date(report.createdAt).toLocaleString('zh-TW')} ·
        <a href="/history" className="ml-1 hover:text-slate-400 transition-colors">查看歷史記錄 →</a>
      </p>
    </div>
  )
}
