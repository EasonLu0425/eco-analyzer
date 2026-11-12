/**
 * Does a factor observed at close i predict the return from close i to close i+h?
 * Uses non-overlapping windows (every h-th day, averaged over all h start offsets) so that
 * autocorrelated overlapping returns do not inflate the statistics. Pure, no I/O.
 */
import { spearman } from './score-study'

export interface FactorStat {
  horizon: number
  n: number                 // mean number of non-overlapping pairs per offset
  ic: number | null         // mean Spearman rank correlation across offsets
  t: number | null
  p: number | null          // two-sided, normal approximation
  byYear: Array<{ year: string; ic: number | null; n: number }> // pooled pairs, so overlapping: a stability read, not a test
}

/** Two-sided tail probability of a standard normal at |z| (Abramowitz & Stegun 7.1.26). */
export function normalTwoSidedP(z: number): number {
  const x = Math.abs(z) / Math.SQRT2
  const t = 1 / (1 + 0.3275911 * x)
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))))
  return Math.min(1, poly * Math.exp(-x * x))
}

type Pair = { x: number; r: number; year: string }

function pairsAt(
  dates: readonly string[], closes: readonly number[], x: ReadonlyArray<number | null>, horizon: number, offset: number,
): Pair[] {
  const out: Pair[] = []
  for (let i = offset; i + horizon < closes.length; i += horizon) {
    const v = x[i]
    if (v != null) out.push({ x: v, r: closes[i + horizon] / closes[i] - 1, year: dates[i].slice(0, 4) })
  }
  return out
}

const ic = (pairs: readonly Pair[]): number | null =>
  pairs.length < 3 ? null : spearman(pairs.map(p => p.x), pairs.map(p => p.r))

export function evaluateFactor(
  dates: readonly string[], closes: readonly number[], x: ReadonlyArray<number | null>, horizon: number,
): FactorStat {
  const perOffset = Array.from({ length: horizon }, (_, off) => pairsAt(dates, closes, x, horizon, off))
  const ics = perOffset.map(ic).filter((v): v is number => v != null)
  const n = Math.round(perOffset.reduce((a, p) => a + p.length, 0) / horizon)

  const mean = ics.length ? ics.reduce((a, b) => a + b, 0) / ics.length : null
  const t = mean != null && n > 2 ? mean * Math.sqrt((n - 2) / Math.max(1e-12, 1 - mean * mean)) : null

  const pooled = perOffset.flat()
  const years = [...new Set(pooled.map(p => p.year))].sort()
  return {
    horizon,
    n: mean == null ? 0 : n,
    ic: mean,
    t,
    p: t == null ? null : normalTwoSidedP(t),
    byYear: years.map(year => {
      const ps = pooled.filter(p => p.year === year)
      return { year, ic: ic(ps), n: ps.length }
    }),
  }
}
