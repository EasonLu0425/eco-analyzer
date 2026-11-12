import { describe, it, expect } from 'vitest'
import { volForecast, volRegime } from '@/lib/vol-forecast'

/** Deterministic standard-normal stream (LCG + Box-Muller). */
function normals(seed: number): () => number {
  let s = seed
  const u = (): number => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return (s + 1) / 4294967297
  }
  return () => Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u())
}

/** Price path from per-day log-return volatility `sigmaAt(i)`. */
function path(n: number, sigmaAt: (i: number) => number, seed = 7): { dates: string[]; closes: number[] } {
  const z = normals(seed)
  const closes = [100]
  for (let i = 1; i < n; i++) closes.push(closes[i - 1] * Math.exp(sigmaAt(i) * z()))
  const dates = closes.map((_, i) => new Date(Date.UTC(2015, 0, 1 + i)).toISOString().slice(0, 10))
  return { dates, closes }
}

const get = (f: ReturnType<typeof volForecast>, h: number) => f!.intervals.find(i => i.horizon === h)!

describe('volForecast', () => {
  it('returns null with too little history', () => {
    const { dates, closes } = path(200, () => 0.01)
    expect(volForecast(dates, closes)).toBeNull()
  })

  it('recovers the width implied by a known constant volatility', () => {
    const { dates, closes } = path(4000, () => 0.01)
    const f = volForecast(dates, closes)
    expect(f!.annualizedVol).toBeCloseTo(0.01 * Math.sqrt(252), 1)
    const iv = get(f, 20)
    // 80% interval of N(0, 0.01*sqrt(20)) = +/-1.2816 * 0.0447 = +/-5.7%
    expect(iv.hi).toBeGreaterThan(0.045)
    expect(iv.hi).toBeLessThan(0.07)
    expect(iv.lo).toBeLessThan(-0.045)
    expect(iv.lo).toBeGreaterThan(-0.07)
  })

  it('widens the interval when recent volatility is higher', () => {
    const calm = path(3000, () => 0.008)
    const burst = path(3000, i => (i > 2970 ? 0.03 : 0.008))
    const w = (p: typeof calm) => { const iv = get(volForecast(p.dates, p.closes), 20); return iv.hi - iv.lo }
    expect(w(burst)).toBeGreaterThan(w(calm) * 1.5)
  })

  it('reports where current volatility sits in its own recent history', () => {
    const burst = path(3000, i => (i > 2970 ? 0.03 : 0.008))
    const calm = path(3000, () => 0.01)
    expect(volForecast(burst.dates, burst.closes)!.volPercentile).toBeGreaterThan(0.95)
    const p = volForecast(calm.dates, calm.closes)!.volPercentile!
    expect(p).toBeGreaterThanOrEqual(0)
    expect(p).toBeLessThanOrEqual(1)
  })

  it('orders each interval, returns simple returns, and flags the 60-day horizon as less reliable', () => {
    const { dates, closes } = path(3000, () => 0.01)
    const f = volForecast(dates, closes)!
    expect(f.intervals.map(i => i.horizon)).toEqual([5, 20, 60])
    for (const iv of f.intervals) {
      expect(iv.lo).toBeLessThan(0)
      expect(iv.hi).toBeGreaterThan(0)
      expect(iv.lo).toBeGreaterThan(-1)
    }
    expect(get(f, 5).reliable).toBe(true)
    expect(get(f, 20).reliable).toBe(true)
    expect(get(f, 60).reliable).toBe(false)
  })

  it('is point-in-time: bars after asOf never change the result', () => {
    const { dates, closes } = path(3000, i => (i > 2900 ? 0.04 : 0.01))
    const k = 2500
    const withFuture = volForecast(dates, closes, { asOf: dates[k] })
    const truncated = volForecast(dates.slice(0, k + 1), closes.slice(0, k + 1))
    expect(withFuture).toEqual(truncated)
    expect(withFuture!.asOf).toBe(dates[k])
  })

  it('returns null when volatility is exactly zero', () => {
    const closes = Array.from({ length: 600 }, () => 100)
    const dates = closes.map((_, i) => new Date(Date.UTC(2015, 0, 1 + i)).toISOString().slice(0, 10))
    expect(volForecast(dates, closes)).toBeNull()
  })
})

describe('volRegime', () => {
  it('labels volatility by its percentile in recent history', () => {
    expect(volRegime(0.05)).toBe('low')
    expect(volRegime(0.5)).toBe('normal')
    expect(volRegime(0.9)).toBe('high')
    expect(volRegime(0.97)).toBe('extreme')
  })

  it('returns unknown when the percentile is unavailable', () => {
    expect(volRegime(null)).toBe('unknown')
  })
})

describe('volForecast point-in-time edge cases', () => {
  const { dates, closes } = path(3000, i => (i > 2900 ? 0.04 : 0.01))

  it('resolves a non-trading asOf to the previous bar', () => {
    const k = 2500
    // 'YYYY-MM-DDT23:59' sorts after that day's bar and before the next day's
    const f = volForecast(dates, closes, { asOf: dates[k] + 'T23:59' })
    expect(f!.asOf).toBe(dates[k])
  })

  it('ignores garbage after asOf', () => {
    const k = 2500
    const poisoned = closes.map((c, i) => (i > k ? NaN : c))
    expect(volForecast(dates, poisoned, { asOf: dates[k] })).toEqual(volForecast(dates.slice(0, k + 1), closes.slice(0, k + 1)))
  })

  it('returns null when asOf precedes the first bar', () => {
    expect(volForecast(dates, closes, { asOf: '2000-01-01' })).toBeNull()
  })

  it('uses the last bar when asOf is after the series end', () => {
    expect(volForecast(dates, closes, { asOf: '2999-01-01' })!.asOf).toBe(dates.at(-1))
  })

  it('returns null when a close inside the window is NaN', () => {
    const bad = closes.map((c, i) => (i === 1000 ? NaN : c))
    expect(volForecast(dates, bad)).toBeNull()
  })
})

describe('volRegime boundaries', () => {
  it('puts each threshold in the higher bucket', () => {
    expect(volRegime(0.2)).toBe('normal')
    expect(volRegime(0.8)).toBe('high')
    expect(volRegime(0.95)).toBe('extreme')
    expect(volRegime(0.1999)).toBe('low')
  })
})

describe('volForecast calibration', () => {
  /** GARCH(1,1)-like path: volatility clusters and mean-reverts. */
  function garch(n: number, seed: number): { dates: string[]; closes: number[] } {
    const z = normals(seed)
    const omega = 2e-6, alpha = 0.08, beta = 0.9
    let v = omega / (1 - alpha - beta)
    const closes = [100]
    for (let i = 1; i < n; i++) {
      const eps = Math.sqrt(v) * z()
      closes.push(closes[i - 1] * Math.exp(eps))
      v = omega + alpha * eps * eps + beta * v
    }
    return { dates: closes.map((_, i) => new Date(Date.UTC(2000, 0, 1 + i)).toISOString().slice(0, 10)), closes }
  }

  function coverage(h: 5 | 20): number {
    const { dates, closes } = garch(6000, 11)
    let hit = 0, n = 0
    for (let k = 1000; k + h < closes.length; k += h) {
      const f = volForecast(dates, closes, { asOf: dates[k] })
      const iv = f!.intervals.find(i => i.horizon === h)!
      const realized = closes[k + h] / closes[k] - 1
      n++
      if (realized >= iv.lo && realized <= iv.hi) hit++
    }
    return hit / n
  }

  it('80% interval covers 70-90% of realized 5-day outcomes (non-overlapping)', () => {
    const c = coverage(5)
    expect(c).toBeGreaterThan(0.7)
    expect(c).toBeLessThan(0.9)
  })

  it('80% interval covers 70-90% of realized 20-day outcomes (non-overlapping)', () => {
    const c = coverage(20)
    expect(c).toBeGreaterThan(0.7)
    expect(c).toBeLessThan(0.9)
  })
})
