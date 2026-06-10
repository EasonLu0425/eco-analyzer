import { describe, it, expect } from 'vitest'
import { computeFearGreed } from '@/lib/fear-greed'
import type { PriceTrend } from '@/types'

const mockTrend: PriceTrend = {
  ticker: '0050.TW',
  currentClose: 150,
  change30d: 5,
  change90d: 10,
  high52w: 200,
  low52w: 100,
}

describe('computeFearGreed', () => {
  it('returns score in 0–100 range', () => {
    const result = computeFearGreed(5, mockTrend, '2026-01-01')
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(100)
  })

  it('uses provided date', () => {
    const result = computeFearGreed(5, mockTrend, '2026-06-10')
    expect(result.date).toBe('2026-06-10')
  })

  it('high sentiment → higher score', () => {
    const high = computeFearGreed(9, mockTrend, '2026-01-01')
    const low = computeFearGreed(2, mockTrend, '2026-01-01')
    expect(high.score).toBeGreaterThan(low.score)
  })

  it('null trend defaults all components to 50', () => {
    const result = computeFearGreed(5, null, '2026-01-01')
    expect(result.score).toBe(50)
    expect(result.components.weeklyPosition).toBe(50)
    expect(result.components.momentum).toBe(50)
  })

  it('extreme-fear label when sentiment=0 and price at 52w low with -20% momentum', () => {
    const bottomTrend: PriceTrend = {
      ticker: '0050.TW', currentClose: 100, change30d: -20,
      change90d: -30, high52w: 200, low52w: 100,
    }
    // sentiment=0, weeklyPosition=0 (at low52w), momentum=0 (change30d=-20) → score=0
    const result = computeFearGreed(0, bottomTrend, '2026-01-01')
    expect(result.score).toBe(0)
    expect(result.label).toBe('extreme-fear')
  })

  it('extreme-greed label when sentiment=10 and price at 52w high with +20% momentum', () => {
    const topTrend: PriceTrend = {
      ticker: '0050.TW', currentClose: 200, change30d: 20,
      change90d: 30, high52w: 200, low52w: 100,
    }
    // sentiment=100, weeklyPosition=100 (at high52w), momentum=100 → score=100
    const result = computeFearGreed(10, topTrend, '2026-01-01')
    expect(result.score).toBe(100)
    expect(result.label).toBe('extreme-greed')
  })

  it('neutral label for sentimentScore 5 with null trend', () => {
    expect(computeFearGreed(5, null, '2026-01-01').label).toBe('neutral')
  })

  it('score matches weighted sum of components', () => {
    const result = computeFearGreed(7, mockTrend, '2026-01-01')
    const expected = Math.round(
      result.components.sentiment * 0.4 +
      result.components.weeklyPosition * 0.3 +
      result.components.momentum * 0.3,
    )
    expect(result.score).toBe(expected)
  })
})
