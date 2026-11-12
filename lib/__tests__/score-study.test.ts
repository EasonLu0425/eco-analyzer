import { describe, it, expect } from 'vitest'
import {
  buildSamples,
  crossTab,
  scoreBucket,
  simulateExposure,
  spearman,
  techState,
  type ScoredSample,
} from '@/lib/score-study'

describe('simulateExposure', () => {
  it('earns the next-bar return only on bars where exposure is 1', () => {
    // exposure[i] decides the i -> i+1 move
    const r = simulateExposure([100, 110, 99, 108.9], [1, 0, 1, 1])
    // bar0->1 +10% (held), bar1->2 skipped, bar2->3 +10% (held)
    expect(r.totalReturnPct).toBeCloseTo((1.1 * 1.1 - 1) * 100, 5)
    expect(r.daysInMarket).toBe(2)
  })

  it('reports the worst peak-to-trough drop of the equity curve', () => {
    const r = simulateExposure([100, 120, 90, 99], [1, 1, 1, 1])
    expect(r.maxDrawdownPct).toBeCloseTo(-25, 5) // 120 -> 90
  })

  it('is flat with zero exposure and handles short series', () => {
    expect(simulateExposure([100, 120], [0, 0])).toEqual({ totalReturnPct: 0, maxDrawdownPct: 0, daysInMarket: 0 })
    expect(simulateExposure([100], [1])).toEqual({ totalReturnPct: 0, maxDrawdownPct: 0, daysInMarket: 0 })
  })
})

describe('spearman', () => {
  it('is 1 for a monotonic increasing relation and -1 for decreasing', () => {
    expect(spearman([1, 2, 3, 4], [10, 20, 35, 90])).toBeCloseTo(1, 5)
    expect(spearman([1, 2, 3, 4], [9, 7, 3, 1])).toBeCloseTo(-1, 5)
  })

  it('handles ties with average ranks', () => {
    expect(spearman([1, 1, 2, 2], [1, 2, 3, 4])).toBeCloseTo(0.8944, 3)
  })

  it('returns null when a series is constant or too short', () => {
    expect(spearman([1, 1, 1], [1, 2, 3])).toBeNull()
    expect(spearman([1], [2])).toBeNull()
  })
})

describe('scoreBucket', () => {
  it('maps sentiment scores to the same bands the prompt uses', () => {
    expect(scoreBucket(0)).toBe('low')
    expect(scoreBucket(3.99)).toBe('low')
    expect(scoreBucket(4)).toBe('mid')
    expect(scoreBucket(6.99)).toBe('mid')
    expect(scoreBucket(7)).toBe('high')
    expect(scoreBucket(10)).toBe('high')
  })
})

describe('techState', () => {
  it('is oversold after a deep pullback even when RSI is neutral', () => {
    expect(techState({ rsi: 50, dd60: -0.09 })).toBe('oversold')
  })

  it('is oversold when RSI is below 35', () => {
    expect(techState({ rsi: 30, dd60: -0.01 })).toBe('oversold')
  })

  it('is overbought when RSI is above 70 and not in a pullback', () => {
    expect(techState({ rsi: 75, dd60: 0 })).toBe('overbought')
  })

  it('is neutral otherwise, including when RSI is not yet defined', () => {
    expect(techState({ rsi: 55, dd60: -0.03 })).toBe('neutral')
    expect(techState({ rsi: null, dd60: -0.01 })).toBe('neutral')
  })

  it('prefers oversold over overbought when both would match', () => {
    expect(techState({ rsi: 72, dd60: -0.12 })).toBe('oversold')
  })
})

describe('buildSamples', () => {
  const dates = ['2026-01-02', '2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08']
  const closes = [100, 90, 99, 110, 121]
  const rsi = [null, 20, 40, 60, 80]

  it('anchors a report on the first trading day on or after its date', () => {
    // 2026-01-03 is a Saturday: anchor to 2026-01-05 (index 1)
    const [s] = buildSamples([{ date: '2026-01-03', score: 3 }], dates, closes, rsi, [1])
    expect(s.fwd[1]).toBeCloseTo(10, 5) // 90 -> 99
    expect(s.rsi).toBe(20)
    expect(s.dd60).toBeCloseTo(-0.1, 5) // 90 vs high 100
  })

  it('returns null forward returns when the window runs past the data', () => {
    const [s] = buildSamples([{ date: '2026-01-08', score: 5 }], dates, closes, rsi, [1, 3])
    expect(s.fwd[1]).toBeNull()
    expect(s.fwd[3]).toBeNull()
  })

  it('drops reports dated after the last price bar', () => {
    expect(buildSamples([{ date: '2026-02-01', score: 5 }], dates, closes, rsi, [1])).toEqual([])
  })
})

describe('crossTab', () => {
  const sample = (score: number, rsi: number | null, dd60: number, fwd20: number | null): ScoredSample => ({
    score,
    rsi,
    dd60,
    fwd: { 20: fwd20 },
  })

  it('groups by score bucket x technical state and averages the forward return', () => {
    const rows = crossTab(
      [
        sample(3, 30, -0.1, 4), // low / oversold
        sample(3, 30, -0.1, 6), // low / oversold
        sample(8, 60, -0.01, -2), // high / neutral
      ],
      20,
    )
    const lowOversold = rows.find(r => r.bucket === 'low' && r.state === 'oversold')
    expect(lowOversold?.summary.n).toBe(2)
    expect(lowOversold?.summary.avg).toBeCloseTo(5, 5)
    const highNeutral = rows.find(r => r.bucket === 'high' && r.state === 'neutral')
    expect(highNeutral?.summary.avg).toBeCloseTo(-2, 5)
  })

  it('skips samples without a forward return and omits empty cells', () => {
    const rows = crossTab([sample(3, 30, -0.1, null), sample(5, 50, 0, 1)], 20)
    expect(rows.some(r => r.bucket === 'low')).toBe(false)
    expect(rows).toHaveLength(1)
  })
})
