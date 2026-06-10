export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { SignalCard } from '@/components/dashboard/SignalCard'
import { HeadlineList } from '@/components/dashboard/HeadlineList'
import { RiskList } from '@/components/dashboard/RiskList'
import { PriceTrendPanel } from '@/components/dashboard/PriceTrendPanel'
import { FearGreedGauge } from '@/components/dashboard/FearGreedGauge'
import { IndicatorPanel } from '@/components/dashboard/IndicatorPanel'
import { CorrelationBadge } from '@/components/dashboard/CorrelationBadge'
import { computeFearGreed } from '@/lib/fear-greed'
import { computeIndicators } from '@/lib/indicators'
import { computeCorrelation } from '@/lib/correlation'
import { getPriceHistory } from '@/lib/price-store'
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
    <div className="animate-pulse">
      <Skeleton className="h-3 w-48 bg-lift mb-5" />
      <Skeleton className="h-px w-full bg-lift mb-8" />
      <Skeleton className="h-20 w-80 bg-lift mb-8" />
      <Skeleton className="h-px w-full bg-lift mb-6" />
      <Skeleton className="h-16 w-full bg-lift mb-6" />
      <Skeleton className="h-px w-full bg-lift" />
    </div>
  )
}

async function DashboardContent() {
  const report = await getLatestReport()
  const priceRecords = getPriceHistory('0050.TW', 90)
  const indicators = computeIndicators(priceRecords, '0050.TW')
  const primaryTrend = report?.priceTrends?.find(t => t.ticker === '0050.TW') ?? null
  const fearGreed = report ? computeFearGreed(report.sentimentScore, primaryTrend, report.date) : null
  const correlation = computeCorrelation('0050.TW', '^GSPC', 30)

  if (!report) {
    return (
      <div className="py-24 text-center space-y-3">
        <p className="text-dim text-base">尚無分析報告</p>
        <p className="text-ghost text-sm">
          執行 <code className="font-mono text-dim">/eco-analyze</code> 觸發分析
        </p>
      </div>
    )
  }

  const dateLabel = new Date(report.date).toLocaleDateString('zh-TW', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  })
  const hasPrices = (report.priceTrends ?? []).length > 0

  return (
    <div>
      <p className="font-mono text-xs text-ghost pb-5">
        {dateLabel} · {report.newsCount} 則新聞
      </p>
      <hr />

      <div className="py-8">
        <SignalCard signal={report.signal} score={report.sentimentScore} />
      </div>
      <hr />

      <div className="py-6">
        <p className="text-dim text-[0.9375rem] leading-relaxed max-w-2xl">{report.summary}</p>
      </div>
      <hr />

      <div className="py-6 grid grid-cols-1 md:grid-cols-[3fr_2fr] gap-8 md:gap-12">
        <div>
          <p className="font-mono text-xs text-ghost mb-4">重點新聞</p>
          <HeadlineList headlines={report.topHeadlines} />
        </div>
        <div>
          <p className="font-mono text-xs text-ghost mb-4">風險因素</p>
          <RiskList risks={report.risks} />
        </div>
      </div>

      {hasPrices && (
        <>
          <hr />
          <div className="py-6">
            <p className="font-mono text-xs text-ghost mb-5">ETF 價格</p>
            <PriceTrendPanel trends={report.priceTrends ?? []} />
          </div>
        </>
      )}

      <hr />
      <div className="py-6">
        <p className="font-mono text-xs text-ghost mb-5">技術指標 · 0050.TW</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
          {fearGreed && (
            <div>
              <p className="font-mono text-[10px] text-zinc-600 mb-2">恐懼貪婪指數</p>
              <FearGreedGauge fearGreed={fearGreed} />
            </div>
          )}
          <div>
            <p className="font-mono text-[10px] text-zinc-600 mb-2">技術指標</p>
            <IndicatorPanel indicators={indicators} />
          </div>
          <div>
            <p className="font-mono text-[10px] text-zinc-600 mb-2">與標普相關性</p>
            <CorrelationBadge correlation={correlation} benchmarkTicker="^GSPC" />
          </div>
        </div>
      </div>

      <hr />
      <p className="py-4 text-xs text-ghost">
        更新於 {new Date(report.createdAt).toLocaleString('zh-TW')}
        <a href="/history" className="ml-2 hover:text-dim transition-colors">歷史記錄 →</a>
      </p>
    </div>
  )
}

export default function DashboardPage() {
  return <Suspense fallback={<DashboardSkeleton />}><DashboardContent /></Suspense>
}
