import { Suspense } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { SignalCard } from '@/components/dashboard/SignalCard'
import { SentimentMeter } from '@/components/dashboard/SentimentMeter'
import { HeadlineList } from '@/components/dashboard/HeadlineList'
import { RiskList } from '@/components/dashboard/RiskList'
import type { AnalysisReport } from '@/types'

async function getLatestReport(): Promise<AnalysisReport | null> {
  try {
    const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'
    const res = await fetch(`${base}/api/reports?latest=true`, { next: { revalidate: 300 } })
    const json = await res.json()
    return json.data ?? null
  } catch { return null }
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex justify-between"><div><Skeleton className="h-4 w-40 mb-2 bg-white/5" /><Skeleton className="h-8 w-32 bg-white/5" /></div></div>
      <Skeleton className="h-44 w-full rounded-2xl bg-white/5" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Skeleton className="h-64 rounded-2xl bg-white/5" />
        <Skeleton className="h-64 rounded-2xl bg-white/5" />
      </div>
    </div>
  )
}

async function DashboardContent() {
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

      <SignalCard signal={report.signal} score={report.sentimentScore} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-[#0C1221] border-white/[0.06]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-slate-200">市場概況</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-6">
            <SentimentMeter score={report.sentimentScore} />
            <Separator className="bg-white/5" />
            <p className="text-slate-400 text-sm leading-relaxed w-full">{report.summary}</p>
          </CardContent>
        </Card>

        <Card className="bg-[#0C1221] border-white/[0.06]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-slate-200">今日重點新聞</CardTitle>
          </CardHeader>
          <CardContent><HeadlineList headlines={report.topHeadlines} /></CardContent>
        </Card>
      </div>

      <Card className="bg-[#0C1221] border-white/[0.06]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-slate-200">風險因素</CardTitle>
        </CardHeader>
        <CardContent><RiskList risks={report.risks} /></CardContent>
      </Card>

      <p className="text-center text-xs text-slate-600">
        最後更新：{new Date(report.createdAt).toLocaleString('zh-TW')} ·
        <a href="/history" className="ml-1 hover:text-slate-400 transition-colors">查看歷史記錄 →</a>
      </p>
    </div>
  )
}

export default function DashboardPage() {
  return <Suspense fallback={<DashboardSkeleton />}><DashboardContent /></Suspense>
}
