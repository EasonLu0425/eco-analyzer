export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import Link from 'next/link'
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
import { getMeta } from '@/lib/meta-store'
import { getNewsForDate } from '@/lib/news-store'
import { SessionNewsPanel } from '@/components/dashboard/SessionNewsPanel'
import { VolForecastPanel } from '@/components/dashboard/VolForecastPanel'
import { volForecast } from '@/lib/vol-forecast'
import { WatchSignalsPanel } from '@/components/dashboard/WatchSignalsPanel'
import { getSeries } from '@/lib/macro-store'
import { getLatestWatchSignals, revenueSignal } from '@/lib/watch-signals'
import { AllocationPanel } from '@/components/portfolio/AllocationPanel'
import { getAllocationAdvice } from '@/lib/allocation-advice'
import type { AnalysisReport } from '@/types'

const ALL_HISTORY = 100000   // price-store limit large enough to mean "every bar"
const INDICATOR_DAYS = 90

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
  const longHistory = getPriceHistory('0050.TW', ALL_HISTORY)
  const priceRecords = longHistory.slice(-INDICATOR_DAYS)
  const indicators = computeIndicators(priceRecords, '0050.TW')
  const primaryTrend = report?.priceTrends?.find(t => t.ticker === '0050.TW') ?? null
  const fearGreed = report ? computeFearGreed(report.sentimentScore, primaryTrend, report.date) : null
  const correlation = computeCorrelation('^TWII', '^GSPC', 30)
  const pricesFetchedAt = getMeta('prices_fetched_at')

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
  const volatility = volForecast(longHistory.map(r => r.date), longHistory.map(r => r.close))
  const tsmcRevenue = revenueSignal(getSeries('rev_yoy:2330'))
  const watchSignals = getLatestWatchSignals()

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

      <hr />
      <div className="py-6">
        <p className="font-mono text-xs text-ghost mb-4">分時段新聞（早盤 / 盤中 / 收盤，各時段只收上一時段之後發佈的新聞）</p>
        <SessionNewsPanel news={getNewsForDate(report.date)} />
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
      <div className="py-6">
        <p className="font-mono text-xs text-ghost mb-5">波動區間預估 · 0050.TW</p>
        <VolForecastPanel forecast={volatility} ticker="0050.TW" />
      </div>

      <hr />
      <div className="py-6">
        <div className="mb-5 flex items-baseline justify-between">
          <p className="font-mono text-xs text-ghost">今日資金配置建議</p>
          <Link href="/portfolio" className="font-mono text-xs text-ghost hover:text-dim transition-colors">管理持倉與預算 →</Link>
        </div>
        <AllocationPanel result={getAllocationAdvice()} />
      </div>

      <hr />
      <div className="py-6">
        <p className="font-mono text-xs text-ghost mb-5">長期觀察訊號 · AI 資本支出論述</p>
        <WatchSignalsPanel revenue={tsmcRevenue} signals={watchSignals} today={report.date} />
      </div>

      <hr />
      <p className="py-4 text-xs text-ghost">
        更新於 {new Date(report.createdAt).toLocaleString('zh-TW')}
        {pricesFetchedAt && (
          <> · 價格資料更新於 {new Date(pricesFetchedAt).toLocaleString('zh-TW')}</>
        )}
        <a href="/history" className="ml-2 hover:text-dim transition-colors">歷史記錄 →</a>
      </p>
    </div>
  )
}

export default function DashboardPage() {
  return <Suspense fallback={<DashboardSkeleton />}><DashboardContent /></Suspense>
}
