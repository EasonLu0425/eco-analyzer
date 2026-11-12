/**
 * Pure helpers for checking whether the daily news sentiment score adds anything once
 * price position (RSI, pullback depth) is taken into account. No I/O.
 */
import { drawdownFromHigh, summarize, type ForwardSummary } from './signal-study'

export type ScoreBucket = 'low' | 'mid' | 'high'
export type TechState = 'oversold' | 'neutral' | 'overbought'

export interface ScoredSample {
  score: number
  rsi: number | null
  dd60: number                        // fraction, 0 at a 60-day high, negative below it
  fwd: Record<number, number | null>  // horizon (bars) -> forward return %, null if window is incomplete
}

export interface CrossTabRow {
  bucket: ScoreBucket
  state: TechState
  summary: ForwardSummary
}

const OVERSOLD_RSI = 35
const OVERBOUGHT_RSI = 70
const OVERSOLD_DRAWDOWN = -0.08
const BUCKET_ORDER: ScoreBucket[] = ['low', 'mid', 'high']
const STATE_ORDER: TechState[] = ['oversold', 'neutral', 'overbought']

/** Same bands as the analyzer prompt: avoid < 4, hold 4-6.99, buy >= 7. */
export function scoreBucket(score: number): ScoreBucket {
  if (score < 4) return 'low'
  if (score >= 7) return 'high'
  return 'mid'
}

/** Price-position label. Oversold wins when both oversold and overbought conditions hold. */
export function techState(f: { rsi: number | null; dd60: number }): TechState {
  if (f.dd60 <= OVERSOLD_DRAWDOWN || (f.rsi != null && f.rsi < OVERSOLD_RSI)) return 'oversold'
  if (f.rsi != null && f.rsi > OVERBOUGHT_RSI) return 'overbought'
  return 'neutral'
}

/**
 * Attach price features and forward returns to each report. A report is anchored to the first
 * trading day on or after its date; reports dated after the last bar are dropped.
 */
export function buildSamples(
  reports: ReadonlyArray<{ date: string; score: number }>,
  dates: readonly string[],
  closes: readonly number[],
  rsi: ReadonlyArray<number | null>,
  horizons: readonly number[],
): ScoredSample[] {
  const dd60 = drawdownFromHigh([...closes], 60)
  const samples: ScoredSample[] = []

  for (const r of reports) {
    const i = dates.findIndex(d => d >= r.date)
    if (i === -1) continue

    const fwd: Record<number, number | null> = {}
    for (const h of horizons) {
      fwd[h] = i + h < closes.length ? (closes[i + h] / closes[i] - 1) * 100 : null
    }
    samples.push({ score: r.score, rsi: rsi[i], dd60: dd60[i], fwd })
  }
  return samples
}

export interface ExposureResult {
  totalReturnPct: number
  maxDrawdownPct: number  // worst peak-to-trough of the equity curve, <= 0
  daysInMarket: number
}

/**
 * Compound the close-to-close return of each bar i -> i+1 scaled by `exposure[i]` (0 = cash,
 * 1 = fully invested). The exposure for bar i must be decided with information up to close i.
 */
export function simulateExposure(closes: readonly number[], exposure: readonly number[]): ExposureResult {
  let equity = 1
  let peak = 1
  let maxDd = 0
  let days = 0
  for (let i = 0; i < closes.length - 1; i++) {
    const e = exposure[i] ?? 0
    if (e > 0) {
      equity *= 1 + e * (closes[i + 1] / closes[i] - 1)
      days++
    }
    peak = Math.max(peak, equity)
    maxDd = Math.min(maxDd, equity / peak - 1)
  }
  return { totalReturnPct: (equity - 1) * 100, maxDrawdownPct: maxDd * 100, daysInMarket: days }
}

function averageRanks(values: readonly number[]): number[] {
  const order = values.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0])
  const ranks: number[] = new Array(values.length)
  let i = 0
  while (i < order.length) {
    let j = i
    while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j++
    const avg = (i + j) / 2 + 1
    for (let k = i; k <= j; k++) ranks[order[k][1]] = avg
    i = j + 1
  }
  return ranks
}

/** Spearman rank correlation (average ranks for ties); null if undefined (n < 2 or a constant series). */
export function spearman(xs: readonly number[], ys: readonly number[]): number | null {
  if (xs.length !== ys.length || xs.length < 2) return null
  const rx = averageRanks(xs)
  const ry = averageRanks(ys)
  const mx = rx.reduce((a, b) => a + b, 0) / rx.length
  const my = ry.reduce((a, b) => a + b, 0) / ry.length
  let cov = 0
  let vx = 0
  let vy = 0
  for (let i = 0; i < rx.length; i++) {
    cov += (rx[i] - mx) * (ry[i] - my)
    vx += (rx[i] - mx) ** 2
    vy += (ry[i] - my) ** 2
  }
  return vx === 0 || vy === 0 ? null : cov / Math.sqrt(vx * vy)
}

/** Score bucket x technical state table of forward returns; cells with no data are omitted. */
export function crossTab(samples: readonly ScoredSample[], horizon: number): CrossTabRow[] {
  const rows: CrossTabRow[] = []
  for (const bucket of BUCKET_ORDER) {
    for (const state of STATE_ORDER) {
      const returns = samples
        .filter(s => scoreBucket(s.score) === bucket && techState(s) === state)
        .map(s => s.fwd[horizon])
        .filter((v): v is number => v != null)
      if (returns.length > 0) rows.push({ bucket, state, summary: summarize(returns, 0) })
    }
  }
  return rows
}
