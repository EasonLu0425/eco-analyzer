export const dynamic = 'force-dynamic'

import { SentimentChart } from '@/components/history/SentimentChart'
import type { AnalysisReport, PaginatedReports } from '@/types'
import Link from 'next/link'

const SIG: Record<string, { label: string; colorClass: string }> = {
  'strong-buy':   { label: '強力買進', colorClass: 'text-buy' },
  'buy':          { label: '建議買進', colorClass: 'text-buy' },
  'hold':         { label: '觀望',    colorClass: 'text-hold' },
  'avoid':        { label: '避開',    colorClass: 'text-avoid' },
  'strong-avoid': { label: '強烈避開', colorClass: 'text-avoid' },
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
  const scoreClass = r.sentimentScore >= 7 ? 'text-buy' : r.sentimentScore >= 4 ? 'text-hold' : 'text-avoid'
  const date = new Date(r.date).toLocaleDateString('zh-TW', { month: 'short', day: 'numeric', weekday: 'short' })
  return (
    <Link
      href={`/history/${r.date}`}
      className="flex items-center gap-4 py-3 border-b border-edge hover:bg-lift transition-colors px-2 -mx-2 rounded-sm"
    >
      <span className="font-mono text-xs text-ghost w-20 shrink-0">{date}</span>
      <span className={`text-sm font-medium w-20 shrink-0 ${s.colorClass}`}>{s.label}</span>
      <p className="text-dim text-sm truncate flex-1">{r.summary}</p>
      <span className={`font-mono text-sm font-semibold shrink-0 ${scoreClass}`}>{r.sentimentScore.toFixed(1)}</span>
    </Link>
  )
}

export default async function HistoryPage() {
  const data = await getReports()

  if (!data || data.reports.length === 0) {
    return (
      <div>
        <h1 className="text-xl font-semibold tracking-tight mb-8">歷史記錄</h1>
        <p className="text-dim text-sm">尚無歷史記錄</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight">歷史記錄</h1>
        <p className="font-mono text-xs text-ghost mt-1">{data.total} 份報告 · 每日 08:30 自動分析</p>
      </div>

      {data.reports.length >= 2 && (
        <div className="mb-8">
          <p className="font-mono text-xs text-ghost mb-4">近 30 日情緒走勢</p>
          <SentimentChart reports={data.reports} />
        </div>
      )}

      <hr />

      <div className="flex items-center gap-4 py-2 px-2 -mx-2 mt-1">
        <span className="font-mono text-xs text-ghost w-20 shrink-0">日期</span>
        <span className="text-xs text-ghost w-20 shrink-0">訊號</span>
        <span className="text-xs text-ghost flex-1">摘要</span>
        <span className="text-xs text-ghost shrink-0">分數</span>
      </div>

      {data.reports.map(r => <Row key={r.id} r={r} />)}
    </div>
  )
}
