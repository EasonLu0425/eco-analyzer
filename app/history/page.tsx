import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SentimentChart } from '@/components/history/SentimentChart'
import type { AnalysisReport, PaginatedReports } from '@/types'
import Link from 'next/link'

const SIG: Record<string, { label: string; color: string }> = {
  'strong-buy':  { label: '強力買進', color: 'text-emerald-400' },
  'buy':         { label: '建議買進', color: 'text-emerald-400' },
  'hold':        { label: '觀望',    color: 'text-amber-400' },
  'avoid':       { label: '避開',    color: 'text-rose-400' },
  'strong-avoid':{ label: '強烈避開', color: 'text-rose-400' },
}

async function getReports(): Promise<PaginatedReports | null> {
  try {
    const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'
    const res = await fetch(`${base}/api/reports?limit=60`, { next: { revalidate: 300 } })
    return (await res.json()).data ?? null
  } catch { return null }
}

function Row({ r }: { r: AnalysisReport }) {
  const s = SIG[r.signal]
  const scoreColor = r.sentimentScore >= 7 ? '#10b981' : r.sentimentScore >= 4 ? '#f59e0b' : '#f43f5e'
  const date = new Date(r.date).toLocaleDateString('zh-TW', { month: 'short', day: 'numeric', weekday: 'short' })
  return (
    <Link href={`/history/${r.date}`}>
      <div className="flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-white/[0.03] transition-colors cursor-pointer border border-transparent hover:border-white/[0.06]">
        <span className="text-slate-500 text-sm font-mono w-20 shrink-0">{date}</span>
        <span className={`text-sm font-medium w-20 shrink-0 ${s.color}`}>{s.label}</span>
        <p className="text-slate-500 text-sm truncate flex-1">{r.summary}</p>
        <span className="font-mono text-sm font-semibold shrink-0" style={{ color: scoreColor }}>{r.sentimentScore.toFixed(1)}</span>
        <Badge variant="outline" className="text-slate-600 border-white/10 text-xs shrink-0">{r.newsCount}則</Badge>
      </div>
    </Link>
  )
}

export default async function HistoryPage() {
  const data = await getReports()
  if (!data || data.reports.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">歷史記錄</h1>
        <div className="text-center py-24 text-slate-500">尚無歷史記錄</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">歷史記錄</h1>
        <p className="text-slate-500 text-sm mt-1">共 {data.total} 份報告，每日 08:30 自動分析</p>
      </div>

      <Card className="bg-[#0C1221] border-white/[0.06]">
        <CardContent className="p-6">
          <SentimentChart reports={data.reports} />
        </CardContent>
      </Card>

      <Card className="bg-[#0C1221] border-white/[0.06]">
        <CardHeader className="pb-2">
          <div className="flex justify-between text-xs text-slate-600 px-4">
            <span>日期</span><span>訊號</span><span className="flex-1 ml-4">摘要</span><span>分數</span>
          </div>
        </CardHeader>
        <CardContent className="p-2 space-y-0.5">
          {data.reports.map(r => <Row key={r.id} r={r} />)}
        </CardContent>
      </Card>
    </div>
  )
}
