/**
 * Volatility-interval forecast. Pure, no I/O.
 *
 * Direction is not predictable from what we tested; volatility is (Spearman of past vs next
 * vol ~ +0.5). So we forecast the *width* of the range, not where inside it price lands.
 *
 * Method (filtered historical simulation):
 *   1. sigma_t = EWMA daily log-return volatility (lambda 0.94) known at close t
 *   2. z = log(P[t+h]/P[t]) / (sigma_t * sqrt(h)) for every t whose outcome is already known
 *   3. interval = exp(sigma_now * sqrt(h) * quantile(z)) - 1 at the 10% / 90% quantiles
 *
 * Point-in-time: only bars up to `asOf` are used; later bars cannot change the result.
 * Walk-forward calibration (scripts/study-vol-calibration.ts -> data/studies/vol-calibration-*.md,
 * ^TWII / 0050 / ^GSPC, 10y): nominal 80% covered ~79-80% at 5d, ~79-82% at 20d, 74-83% at 60d.
 * The 60d figure rests on only ~20 independent windows, so that horizon is flagged.
 * Quantiles include the sample's own drift, so bounds lean upward in a rising market.
 */

export const HORIZONS = [5, 20, 60] as const
export type Horizon = (typeof HORIZONS)[number]

const LAMBDA = 0.94
const SEED_WINDOW = 20           // returns used to seed the EWMA variance
const WARMUP = 60                // bars before the EWMA is trusted as a standardizer
const MIN_BARS = 500
const LOW_Q = 0.1
const HIGH_Q = 0.9
const TRADING_DAYS = 252
const PERCENTILE_WINDOW = 1260   // ~5 years of sigma history
const MAX_RELIABLE_HORIZON = 20

export interface VolInterval {
  horizon: Horizon
  lo: number              // simple return, 10th percentile
  hi: number              // simple return, 90th percentile
  samples: number         // standardized outcomes behind the quantiles (overlapping)
  reliable: boolean       // false = small-sample horizon, observed coverage below nominal
}

export interface VolForecast {
  asOf: string
  sigmaDaily: number
  annualizedVol: number
  volPercentile: number | null  // 0..1, share of the trusted sigma history at or below today's
  volHistoryYears: number       // how many years that history actually spans (<= 5)
  intervals: VolInterval[]
}

export interface VolForecastOptions {
  asOf?: string
}

export type VolRegime = 'low' | 'normal' | 'high' | 'extreme' | 'unknown'

const REGIME_LOW = 0.2
const REGIME_HIGH = 0.8
const REGIME_EXTREME = 0.95

export function volRegime(percentile: number | null): VolRegime {
  if (percentile == null) return 'unknown'
  if (percentile >= REGIME_EXTREME) return 'extreme'
  if (percentile >= REGIME_HIGH) return 'high'
  if (percentile < REGIME_LOW) return 'low'
  return 'normal'
}

function ewmaSigmas(logRets: readonly number[]): number[] {
  const seed = logRets.slice(0, SEED_WINDOW)
  let variance = seed.reduce((a, r) => a + r * r, 0) / seed.length
  return logRets.map(r => {
    variance = LAMBDA * variance + (1 - LAMBDA) * r * r
    return Math.sqrt(variance)
  })
}

function quantile(sorted: readonly number[], q: number): number {
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

function lastIndexOnOrBefore(dates: readonly string[], asOf: string): number {
  for (let i = dates.length - 1; i >= 0; i--) if (dates[i] <= asOf) return i
  return -1
}

function intervalFor(h: Horizon, px: readonly number[], sigmas: readonly number[], sigmaNow: number, end: number): VolInterval {
  const z: number[] = []
  for (let t = WARMUP; t + h <= end; t++) {
    const s = sigmas[t - 1]   // volatility known at close of bar t
    if (s > 0) z.push(Math.log(px[t + h] / px[t]) / (s * Math.sqrt(h)))
  }
  const sorted = [...z].sort((a, b) => a - b)
  const width = sigmaNow * Math.sqrt(h)
  return {
    horizon: h,
    lo: Math.exp(width * quantile(sorted, LOW_Q)) - 1,
    hi: Math.exp(width * quantile(sorted, HIGH_Q)) - 1,
    samples: z.length,
    reliable: h <= MAX_RELIABLE_HORIZON,
  }
}

export function volForecast(
  dates: readonly string[], closes: readonly number[], opts: VolForecastOptions = {},
): VolForecast | null {
  const end = opts.asOf ? lastIndexOnOrBefore(dates, opts.asOf) : closes.length - 1
  if (end + 1 < MIN_BARS) return null

  const px = closes.slice(0, end + 1)
  if (px.some(p => !(p > 0))) return null

  // logRets[i] is the return px[i] -> px[i+1]; sigmas[i] is the EWMA known at close of px[i+1].
  const logRets = px.slice(1).map((p, i) => Math.log(p / px[i]))
  const sigmas = ewmaSigmas(logRets)
  const sigmaNow = sigmas[sigmas.length - 1]
  if (!(sigmaNow > 0)) return null

  const intervals = HORIZONS.map(h => intervalFor(h, px, sigmas, sigmaNow, end))
  if (intervals.some(iv => !Number.isFinite(iv.lo) || !Number.isFinite(iv.hi))) return null

  // Skip the seed-contaminated warmup so the percentile only ranks trusted sigmas.
  const history = sigmas.slice(WARMUP).slice(-PERCENTILE_WINDOW)
  return {
    asOf: dates[end],
    sigmaDaily: sigmaNow,
    annualizedVol: sigmaNow * Math.sqrt(TRADING_DAYS),
    volPercentile: history.length > 0 ? history.filter(s => s <= sigmaNow).length / history.length : null,
    volHistoryYears: Math.round(history.length / TRADING_DAYS),
    intervals,
  }
}
