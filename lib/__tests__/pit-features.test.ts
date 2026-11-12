import { describe, it, expect } from 'vitest'
import { techContext } from '@/lib/pit-features'
import type { PriceRecord } from '@/types'

function bars(closes: number[], startDay = 0): PriceRecord[] {
  return closes.map((c, i) => {
    const d = new Date(Date.UTC(2025, 0, 1 + startDay + i)).toISOString().slice(0, 10)
    return { date: d, open: c, high: c * 1.01, low: c * 0.99, close: c, volume: 1000 }
  })
}

const rising = (n: number, from = 100, step = 0.5) => Array.from({ length: n }, (_, i) => from + i * step)

describe('techContext', () => {
  it('returns null when there are too few bars to compute anything', () => {
    expect(techContext(bars(rising(10)), '2025-12-31')).toBeNull()
  })

  it('uses only bars on or before the as-of date (no look-ahead)', () => {
    const all = bars([...rising(260), 50, 40, 30]) // crash AFTER the as-of date
    const asOf = all[259].date
    const withFuture = techContext(all, asOf)
    const withoutFuture = techContext(all.slice(0, 260), asOf)
    expect(withFuture).toEqual(withoutFuture)
  })

  it('anchors to the last trading day on or before the as-of date', () => {
    const all = bars(rising(260))
    const ctx = techContext(all, '2099-01-01')
    expect(ctx?.date).toBe(all[259].date)
  })

  it('labels a steady climb as an uptrend above both moving averages', () => {
    const ctx = techContext(bars(rising(260)), '2099-01-01')
    expect(ctx?.trend).toBe('up')
    expect(ctx?.aboveMa60).toBe(true)
    expect(ctx?.aboveMa200).toBe(true)
    expect(ctx?.dd252).toBe(0)
  })

  it('labels a steady decline as a downtrend with a negative drawdown', () => {
    const ctx = techContext(bars(rising(260, 300, -0.5)), '2099-01-01')
    expect(ctx?.trend).toBe('down')
    expect(ctx?.aboveMa200).toBe(false)
    expect(ctx?.dd252).toBeLessThan(0)
  })

  it('falls back to MA60 only when fewer than 200 bars exist', () => {
    const ctx = techContext(bars(rising(120)), '2099-01-01')
    expect(ctx?.ma200).toBeNull()
    expect(ctx?.aboveMa200).toBeNull()
    expect(ctx?.trend).toBe('up')
  })

  it('reports 30 and 90 day changes against the right bars', () => {
    const closes = rising(120, 100, 1) // 100..219
    const ctx = techContext(bars(closes), '2099-01-01')
    expect(ctx?.change30d).toBeCloseTo(((219 / 189) - 1) * 100, 1)
    expect(ctx?.change90d).toBeCloseTo(((219 / 129) - 1) * 100, 1)
  })
})
