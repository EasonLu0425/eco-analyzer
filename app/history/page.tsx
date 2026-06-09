import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { AnalysisReport, PaginatedReports } from '@/types'
import Link from 'next/link'

const SIGNAL_CONFIG = {
  'strong-buy':  { label: '強力買進', color: 'text-emerald-400' },
  'buy':         { label: '建議買進', color: 'text-emerald-400' },
  'hold':        { label: '觀望',    color: 'text-amber-400' },
  'avoid':       { label: '避開',    color: 'text-rose-400' },
  'strong-avoid':{ label: '強烈避開', color: 'text-rose-400' },
} as const

async function getReports(): Promise<PaginatedReports | null> {
  try {
    const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'
    const res = await fetch(`${base}/api/reports?limit=60`, { next: { revalidate: 300 } })
    const json = await res.json()
    return json.data ?? null
  } catch {
    return null
  }
}

function ReportRow({ r }: { r: AnalysisReport }) {
  const cfg = SIGNAL_CONFIG[r.signal]
  const scoreColor = r.sentimentScore >= 7 ? '#10b981' : r.sentimentScore >= 4 ? '#f59e0b' : '#f43f5e'
  const dateLabel = new Date(r.date).toLocaleDateString('zh-TW', { month: 'short', day: 'numeric', weekday: 'short' })

  return (
    <Link href={`/history/${r.date}`}>
      <Card className="bg-[#0C1221] border-white/[0.06] hover:border-white/10 hover:bg-[#0F1729] transition-all cursor-pointer">
        <CardContent className="p-4 flex items-center gap-4">
          <span className="text-slate-500 text-sm font-mono w-20 shrink-0">{dateLabel}</span>
          <span className={`text-sm font-medium shrink-0 w-20 ${cfg.color}`}>{cfg.label}</span>
          <p className="text-slate-500 text-sm truncate flex-1">{r.summary}</p>
          <span className="font-mono text-sm font-semibold shrink-0" style={{ color: scoreColor }}>{r.sentimentScore.toFixed(1)}</span>
          <Badge variant="outline" className="text-slate-500 border-white/10 text-xs shrink-0">{r.newsCount}則</Badge>
        </CardContent>
      </Card>
    </Link>
  )
}

export default async function HistoryPage() {
  const data = await getReports()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">歷史記錄</h1>
        <p className="text-slate-500 text-sm mt-1">每日 08:30 自動分析報告</p>
      </div>
      {!data || data.reports.length === 0
        ? <div className="text-center py-24 text-slate-500">尚無歷史記錄</div>
        : <div className="space-y-2">{data.reports.map(r => <ReportRow key={r.id} r={r} />)}</div>
      }
    </div>
  )
}
