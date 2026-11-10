import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { SignalCard } from '@/components/dashboard/SignalCard'
import { SentimentMeter } from '@/components/dashboard/SentimentMeter'
import { HeadlineList } from '@/components/dashboard/HeadlineList'
import { SessionNewsPanel } from '@/components/dashboard/SessionNewsPanel'
import { getNewsForDate } from '@/lib/news-store'
import type { AnalysisReport } from '@/types'

async function getReport(date: string): Promise<AnalysisReport | null> {
  try {
    const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'
    const res = await fetch(`${base}/api/reports?date=${date}`, { next: { revalidate: 300 } })
    if (!res.ok) return null
    return (await res.json()).data ?? null
  } catch { return null }
}

export default async function ReportPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params
  const report = await getReport(date)
  if (!report) notFound()

  const dateLabel = new Date(report.date).toLocaleDateString('zh-TW', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/history" className="text-slate-500 hover:text-slate-300 transition-colors text-sm">← 歷史記錄</Link>
        <Separator orientation="vertical" className="h-4 bg-white/10" />
        <div>
          <p className="text-slate-500 text-sm">{dateLabel}</p>
          <h1 className="text-xl font-bold tracking-tight">分析報告</h1>
        </div>
        <Badge variant="outline" className="ml-auto text-slate-400 border-white/10">{report.newsCount} 則新聞</Badge>
      </div>

      <SignalCard signal={report.signal} score={report.sentimentScore} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-[#0C1221] border-white/[0.06]">
          <CardHeader className="pb-3"><CardTitle className="text-base text-slate-200">市場概況</CardTitle></CardHeader>
          <CardContent className="flex flex-col items-center gap-6">
            <SentimentMeter score={report.sentimentScore} />
            <Separator className="bg-white/5" />
            <p className="text-slate-400 text-sm leading-relaxed w-full">{report.summary}</p>
          </CardContent>
        </Card>

        <Card className="bg-[#0C1221] border-white/[0.06]">
          <CardHeader className="pb-3"><CardTitle className="text-base text-slate-200">重點新聞</CardTitle></CardHeader>
          <CardContent>
            <HeadlineList headlines={report.topHeadlines} />
          </CardContent>
        </Card>
      </div>

      <Card className="bg-[#0C1221] border-white/[0.06]">
        <CardHeader className="pb-3"><CardTitle className="text-base text-slate-200">分時段新聞</CardTitle></CardHeader>
        <CardContent>
          <SessionNewsPanel news={getNewsForDate(report.date)} />
        </CardContent>
      </Card>

      <Card className="bg-[#0C1221] border-white/[0.06]">
        <CardHeader className="pb-3"><CardTitle className="text-base text-slate-200">風險因素</CardTitle></CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {report.risks.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-400">
                <span className="text-rose-400 mt-0.5 shrink-0">▸</span>{r}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-slate-600">
        分析時間：{new Date(report.createdAt).toLocaleString('zh-TW')}
      </p>
    </div>
  )
}
