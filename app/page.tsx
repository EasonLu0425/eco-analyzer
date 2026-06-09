import { Suspense } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SignalCard } from '@/components/dashboard/SignalCard'
import { SentimentMeter } from '@/components/dashboard/SentimentMeter'
import { HeadlineList } from '@/components/dashboard/HeadlineList'
import { RiskList } from '@/components/dashboard/RiskList'
import { PriceTrendPanel } from '@/components/dashboard/PriceTrendPanel'
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
      <div className="flex gap-2 mt-4">
        {[1,2,3,4].map(n => <Skeleton key={n} className="h-9 w-24 rounded-lg bg-white/5" />)}
      </div>
      <Skeleton className="h-64 w-full rounded-2xl bg-white/5" />
    </div>
  )
}

async function DashboardContent() {
  const report = await getLatestReport()

  if (!report) {
    return (
      <div className="text-center py-24 space-y-4">
        <div className="text-5xl">📊</div>
        <p className="text-slate-400 text-lg">尚無分析報告</p>
        <p className="text-slate-600 text-sm">在 Claude Code 執行 <code className="text-slate-500">/eco-analyze</code> 觸發分析</p>
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

      <Tabs defaultValue="signal" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="signal">分析結果</TabsTrigger>
          <TabsTrigger value="headlines">重點新聞</TabsTrigger>
          <TabsTrigger value="overview">市場概況</TabsTrigger>
          <TabsTrigger value="risks">風險因素</TabsTrigger>
        </TabsList>

        <TabsContent value="signal" className="mt-4 space-y-4">
          <SignalCard signal={report.signal} score={report.sentimentScore} />
          <Card className="bg-[#0C1221] border-white/[0.06]">
            <CardContent className="pt-5">
              <p className="text-slate-400 text-sm leading-relaxed">{report.summary}</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="headlines" className="mt-4">
          <Card className="bg-[#0C1221] border-white/[0.06]">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-slate-200">今日重點新聞</CardTitle>
              <p className="text-xs text-slate-500">含內容摘要與市場影響分析</p>
            </CardHeader>
            <CardContent><HeadlineList headlines={report.topHeadlines} /></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <Card className="bg-[#0C1221] border-white/[0.06]">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-slate-200">市場概況</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-6">
              <SentimentMeter score={report.sentimentScore} />
              <Separator className="bg-white/5" />
              <div className="w-full space-y-3">
                <p className="text-slate-400 text-sm leading-relaxed">{report.summary}</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Badge variant="outline" className="text-slate-500 border-white/10 text-xs">分析新聞數：{report.newsCount} 則</Badge>
                  <Badge variant="outline" className="text-slate-500 border-white/10 text-xs">情緒分數：{report.sentimentScore} / 10</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#0C1221] border-white/[0.06]">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-slate-200">ETF 價格趨勢</CardTitle>
              <p className="text-xs text-slate-500">相對 52 週高低點位置與近期漲跌幅</p>
            </CardHeader>
            <CardContent>
              <PriceTrendPanel trends={report.priceTrends ?? []} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risks" className="mt-4">
          <Card className="bg-[#0C1221] border-white/[0.06]">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-slate-200">風險因素</CardTitle>
              <p className="text-xs text-slate-500">需留意的潛在市場風險</p>
            </CardHeader>
            <CardContent><RiskList risks={report.risks} /></CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
