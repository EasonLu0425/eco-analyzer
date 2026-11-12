/**
 * Point-in-time technical context: everything an analyst could have known at the close of
 * `asOf`. Bars dated after `asOf` are discarded before any calculation, so the result can never
 * depend on the future. Pure, no I/O.
 */
import { computeIndicators } from './indicators'
import { drawdownFromHigh, sma } from './signal-study'
import type { PriceRecord } from '@/types'

export type Trend = 'up' | 'down' | 'mixed'

export interface TechContext {
  date: string                 // last trading day used (<= asOf)
  close: number
  change30d: number            // % vs 30 bars earlier
  change90d: number | null     // null when fewer than 91 bars
  high52w: number
  low52w: number
  rsi14: number | null
  macdHist: number | null
  bbPos: number | null         // 0-100
  ma60: number | null
  ma200: number | null
  aboveMa60: boolean | null
  aboveMa200: boolean | null
  ma60Slope20: number | null   // % change of MA60 over the last 20 bars
  dd252: number                // fraction below the trailing 252-bar closing high (<= 0)
  trend: Trend
}

const MIN_BARS = 31 // same floor as getPriceTrend
const round2 = (v: number): number => Math.round(v * 100) / 100

function classifyTrend(aboveMa60: boolean | null, aboveMa200: boolean | null, slope: number | null): Trend {
  if (slope == null) return 'mixed'
  // Prefer the long average; with <200 bars, MA60 alone has to do the job.
  const above = aboveMa200 ?? aboveMa60
  if (above === true && slope > 0) return 'up'
  if (above === false && slope < 0) return 'down'
  return 'mixed'
}

export function techContext(records: readonly PriceRecord[], asOf: string): TechContext | null {
  const hist = records.filter(r => r.date <= asOf)
  if (hist.length < MIN_BARS) return null

  const closes = hist.map(r => r.close)
  const last = hist.length - 1
  const ind = computeIndicators([...hist])[last]
  const ma60s = sma(closes, 60)
  const ma200s = sma(closes, 200)

  const ma60 = ma60s[last]
  const ma200 = ma200s[last]
  const ma60Prev = last >= 20 ? ma60s[last - 20] : null
  const slope = ma60 != null && ma60Prev != null ? (ma60 / ma60Prev - 1) * 100 : null
  const aboveMa60 = ma60 == null ? null : closes[last] >= ma60
  const aboveMa200 = ma200 == null ? null : closes[last] >= ma200

  const win = hist.slice(-365)
  return {
    date: hist[last].date,
    close: closes[last],
    change30d: round2((closes[last] / closes[last - 30] - 1) * 100),
    change90d: last >= 90 ? round2((closes[last] / closes[last - 90] - 1) * 100) : null,
    high52w: Math.max(...win.map(r => r.high)),
    low52w: Math.min(...win.map(r => r.low)),
    rsi14: ind.rsi14,
    macdHist: ind.macdHistogram,
    bbPos: ind.bbPosition,
    ma60,
    ma200,
    aboveMa60,
    aboveMa200,
    ma60Slope20: slope == null ? null : round2(slope),
    dd252: drawdownFromHigh(closes, 252)[last],
    trend: classifyTrend(aboveMa60, aboveMa200, slope),
  }
}
