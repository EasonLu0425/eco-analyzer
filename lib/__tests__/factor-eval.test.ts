import { describe, it, expect } from 'vitest'
import { evaluateFactor, normalTwoSidedP } from '@/lib/factor-eval'

/** Deterministic pseudo-random numbers in [0,1). */
function lcg(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

function market(n: number, seed = 1) {
  const rnd = lcg(seed)
  const dates = Array.from({ length: n }, (_, i) => new Date(Date.UTC(2020, 0, 1 + i)).toISOString().slice(0, 10))
  const closes: number[] = [100]
  for (let i = 1; i < n; i++) closes.push(closes[i - 1] * (1 + (rnd() - 0.5) * 0.04))
  return { dates, closes }
}

const fwd = (closes: number[], i: number, h: number): number | null =>
  i + h < closes.length ? closes[i + h] / closes[i] - 1 : null

describe('normalTwoSidedP', () => {
  it('matches the standard normal tails', () => {
    expect(normalTwoSidedP(0)).toBeCloseTo(1, 6)
    expect(normalTwoSidedP(1.96)).toBeCloseTo(0.05, 3)
    expect(normalTwoSidedP(-2.576)).toBeCloseTo(0.01, 3)
  })
})

describe('evaluateFactor', () => {
  const { dates, closes } = market(600)

  it('scores a factor that equals the future return as a near-perfect predictor', () => {
    const x = closes.map((_, i) => fwd(closes, i, 5))
    const r = evaluateFactor(dates, closes, x, 5)
    expect(r.ic).toBeGreaterThan(0.99)
    expect(r.p).toBeLessThan(1e-6)
  })

  it('scores the negated future return as a near-perfect anti-predictor', () => {
    const x = closes.map((_, i) => { const f = fwd(closes, i, 5); return f == null ? null : -f })
    expect(evaluateFactor(dates, closes, x, 5).ic).toBeLessThan(-0.99)
  })

  it('finds no edge in an unrelated random factor', () => {
    const rnd = lcg(99)
    const x = closes.map(() => rnd())
    const r = evaluateFactor(dates, closes, x, 5)
    expect(Math.abs(r.ic ?? 1)).toBeLessThan(0.15)
    expect(r.p).toBeGreaterThan(0.01)
  })

  it('uses non-overlapping windows: about (N - h) / h samples per offset', () => {
    const x = closes.map(() => 1).map((v, i) => v + i)
    const r = evaluateFactor(dates, closes, x, 20)
    expect(r.n).toBeGreaterThanOrEqual(28)
    expect(r.n).toBeLessThanOrEqual(30)
  })

  it('skips missing factor values and reports null IC when nothing is usable', () => {
    expect(evaluateFactor(dates, closes, closes.map(() => null), 5)).toMatchObject({ ic: null, t: null, p: null, n: 0 })
    const x = closes.map((_, i) => (i < 300 ? null : fwd(closes, i, 5)))
    const r = evaluateFactor(dates, closes, x, 5)
    expect(r.ic).toBeGreaterThan(0.99)
    expect(r.byYear.every(y => y.year >= '2020')).toBe(true)
  })

  it('never uses a factor value whose forward window runs past the data', () => {
    // the last h factor values have no forward return; poison them and the result must not change
    const x = closes.map((_, i) => fwd(closes, i, 5))
    const poisoned = x.map((v, i) => (i >= closes.length - 5 ? 1e9 : v))
    expect(evaluateFactor(dates, closes, poisoned, 5)).toEqual(evaluateFactor(dates, closes, x, 5))
  })

  it('breaks the result down by calendar year', () => {
    const x = closes.map((_, i) => fwd(closes, i, 5))
    const years = evaluateFactor(dates, closes, x, 5).byYear.map(y => y.year)
    expect(years).toEqual(['2020', '2021'])
  })
})
