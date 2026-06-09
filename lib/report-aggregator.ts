import type { AnalysisReport, ETFSignal, PeriodPricePerformance, PriceRecord } from '@/types'

const SIGNAL_BULLISHNESS: ETFSignal[] = ['strong-buy', 'buy', 'hold', 'avoid', 'strong-avoid']

export function dominantSignal(signals: ETFSignal[]): ETFSignal {
  if (signals.length === 0) return 'hold'

  const counts = new Map<ETFSignal, number>()
  for (const s of signals) counts.set(s, (counts.get(s) ?? 0) + 1)

  const maxCount = Math.max(...counts.values())
  const tied = SIGNAL_BULLISHNESS.filter(s => counts.get(s) === maxCount)
  return tied[0]
}

export function sentimentTrend(scores: number[]): 'improving' | 'declining' | 'stable' {
  if (scores.length < 2) return 'stable'

  const mid = Math.floor(scores.length / 2)
  const firstHalf = scores.slice(0, mid)
  const secondHalf = scores.slice(mid)

  const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length
  const diff = avg(secondHalf) - avg(firstHalf)

  if (diff > 0.5) return 'improving'
  if (diff < -0.5) return 'declining'
  return 'stable'
}

export function computePricePerformance(
  records: PriceRecord[],
  ticker: string
): PeriodPricePerformance | null {
  if (records.length === 0) return null

  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date))
  const startClose = sorted[0].close
  const endClose = sorted[sorted.length - 1].close
  const changePct = startClose === 0 ? 0 : ((endClose - startClose) / startClose) * 100
  const high = Math.max(...sorted.map(r => r.high))
  const low = Math.min(...sorted.map(r => r.low))

  return { ticker, startClose, endClose, changePct, high, low }
}

export function aggregateDailyReports(reports: AnalysisReport[]): {
  avgSentimentScore: number
  topRisks: string[]
} {
  if (reports.length === 0) return { avgSentimentScore: 0, topRisks: [] }

  const avg = reports.reduce((s, r) => s + r.sentimentScore, 0) / reports.length
  const avgSentimentScore = Math.round(avg * 100) / 100

  const seen = new Set<string>()
  const topRisks: string[] = []
  for (const report of reports) {
    for (const risk of report.risks) {
      if (!seen.has(risk) && topRisks.length < 5) {
        seen.add(risk)
        topRisks.push(risk)
      }
    }
  }

  return { avgSentimentScore, topRisks }
}
