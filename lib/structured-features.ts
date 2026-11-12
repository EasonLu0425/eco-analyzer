/**
 * Structured (non-news) market factors, computed point-in-time. Every input series is cut to
 * points dated STRICTLY BEFORE the decision day, so a factor can never see the day's own
 * (or any later) data. This also gives the right conservative lags: Taiwan flows/margin are
 * published after the close, US closes happen after Taiwan's, FX is a 24h quote.
 * Pure, no I/O.
 */
import type { SeriesPoint } from './macro-store'

export interface MacroData {
  foreignNet: SeriesPoint[]            // daily foreign net buy (TWD)
  margin: SeriesPoint[]                // market margin-purchase balance (TWD)
  sox: SeriesPoint[]                   // Philadelphia semiconductor index close
  vix: SeriesPoint[]
  tnx: SeriesPoint[]                   // US 10y yield, percent
  usdtwd: SeriesPoint[]                // USD/TWD (up = TWD weaker)
  revYoy: Record<string, SeriesPoint[]> // bellwether -> monthly revenue YoY, dated when knowable
}

export interface StructuredFeatures {
  foreignFlowZ: number | null     // 5-day foreign net buy vs its own past-year distribution
  soxMom20: number | null         // SOX return over 20 observations
  revMomentum: number | null      // median over bellwethers of (latest YoY - YoY three reports earlier)
  marginChange20: number | null   // margin balance change over 20 observations
  vixPct: number | null           // percentile (0-1) of latest VIX within the past year
  tnxChange20: number | null      // change in US 10y yield (percentage points)
  usdtwdChange20: number | null   // USD/TWD relative change (positive = TWD weakening)
}

export const FEATURE_KEYS = [
  'foreignFlowZ', 'soxMom20', 'revMomentum', 'marginChange20', 'vixPct', 'tnxChange20', 'usdtwdChange20',
] as const satisfies ReadonlyArray<keyof StructuredFeatures>

const YEAR = 250
const MIN_YEAR_OBS = 120
const FLOW_WINDOW = 5
const MOM_WINDOW = 20
const REV_LOOKBACK = 3
const MIN_BELLWETHERS = 4

/** Number of leading points with date < day (points are sorted ascending). */
function countBefore(points: readonly SeriesPoint[], day: string): number {
  let lo = 0
  let hi = points.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (points[mid].date < day) lo = mid + 1
    else hi = mid
  }
  return lo
}

function visible(points: readonly SeriesPoint[], day: string): number[] {
  return points.slice(0, countBefore(points, day)).map(p => p.value)
}

const mean = (v: readonly number[]): number => v.reduce((a, b) => a + b, 0) / v.length
const std = (v: readonly number[]): number => {
  const m = mean(v)
  return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length)
}
const median = (v: readonly number[]): number => {
  const s = [...v].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

function change(values: readonly number[], window: number, relative: boolean): number | null {
  if (values.length <= window) return null
  const last = values[values.length - 1]
  const past = values[values.length - 1 - window]
  if (relative && past === 0) return null
  return relative ? last / past - 1 : last - past
}

function foreignFlowZ(values: readonly number[]): number | null {
  const tail = values.slice(-(YEAR + FLOW_WINDOW - 1))
  if (tail.length < MIN_YEAR_OBS + FLOW_WINDOW - 1) return null
  const sums: number[] = []
  for (let i = FLOW_WINDOW - 1; i < tail.length; i++) {
    sums.push(tail.slice(i - FLOW_WINDOW + 1, i + 1).reduce((a, b) => a + b, 0))
  }
  const s = std(sums)
  return s === 0 ? null : (sums[sums.length - 1] - mean(sums)) / s
}

function vixPercentile(values: readonly number[]): number | null {
  const tail = values.slice(-YEAR)
  if (tail.length < MIN_YEAR_OBS) return null
  const latest = tail[tail.length - 1]
  return tail.filter(v => v < latest).length / (tail.length - 1)
}

function revMomentum(revYoy: Record<string, SeriesPoint[]>, day: string): number | null {
  const changes: number[] = []
  for (const pts of Object.values(revYoy)) {
    const v = visible(pts, day)
    if (v.length > REV_LOOKBACK) changes.push(v[v.length - 1] - v[v.length - 1 - REV_LOOKBACK])
  }
  return changes.length >= MIN_BELLWETHERS ? median(changes) : null
}

export function structuredFeatures(day: string, data: MacroData): StructuredFeatures {
  return {
    foreignFlowZ: foreignFlowZ(visible(data.foreignNet, day)),
    soxMom20: change(visible(data.sox, day), MOM_WINDOW, true),
    revMomentum: revMomentum(data.revYoy, day),
    marginChange20: change(visible(data.margin, day), MOM_WINDOW, true),
    vixPct: vixPercentile(visible(data.vix, day)),
    tnxChange20: change(visible(data.tnx, day), MOM_WINDOW, false),
    usdtwdChange20: change(visible(data.usdtwd, day), MOM_WINDOW, true),
  }
}

/**
 * z-score of each value against the `window` values ending at it (population std).
 * Null where the window is incomplete, contains a null, or is constant.
 */
export function trailingZ(values: ReadonlyArray<number | null>, window: number): Array<number | null> {
  return values.map((v, i) => {
    if (v == null || i < window - 1) return null
    const w = values.slice(i - window + 1, i + 1)
    if (w.some(x => x == null)) return null
    const nums = w as number[]
    const s = std(nums)
    return s === 0 ? null : (v - mean(nums)) / s
  })
}
