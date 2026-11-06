import { describe, it, expect } from 'vitest'
import {
  drawdownFromHigh,
  forwardReturns,
  selectEpisodes,
  sma,
  summarize,
} from '@/lib/signal-study'

describe('sma', () => {
  it('returns null until the window is full, then the rolling mean', () => {
    expect(sma([1, 2, 3, 4], 3)).toEqual([null, null, 2, 3])
  })

  it('returns all nulls when the series is shorter than the window', () => {
    expect(sma([1, 2], 5)).toEqual([null, null])
  })
})

describe('drawdownFromHigh', () => {
  it('is 0 at a new high and negative below the rolling high', () => {
    const dd = drawdownFromHigh([100, 110, 99, 120], 10)
    expect(dd[0]).toBe(0)
    expect(dd[1]).toBe(0)
    expect(dd[2]).toBeCloseTo(-0.1, 5)
    expect(dd[3]).toBe(0)
  })

  it('forgets highs that fall outside the window', () => {
    // window 2: at index 3 only [90, 95] count, so no drawdown from the old 200
    const dd = drawdownFromHigh([200, 100, 90, 95], 2)
    expect(dd[3]).toBeCloseTo(0, 5)
    expect(dd[1]).toBeCloseTo(-0.5, 5)
  })
})

describe('selectEpisodes', () => {
  it('keeps the first flagged index and skips flags inside the cooldown', () => {
    const flags = [false, true, true, true, false, false, true, true]
    expect(selectEpisodes(flags, 3)).toEqual([1, 6])
  })

  it('returns every flagged index when cooldown is 0', () => {
    expect(selectEpisodes([true, false, true], 0)).toEqual([0, 2])
  })

  it('returns an empty list when nothing is flagged', () => {
    expect(selectEpisodes([false, false], 5)).toEqual([])
  })
})

describe('forwardReturns', () => {
  const closes = [100, 110, 121, 100]

  it('returns percentage change h bars ahead for each index', () => {
    const r = forwardReturns(closes, [0, 1], 1)
    expect(r).toHaveLength(2)
    expect(r[0]).toBeCloseTo(10, 5)
    expect(r[1]).toBeCloseTo(10, 5)
  })

  it('drops indexes whose forward window runs past the end of the data', () => {
    // only index 0 has an i+2 bar (index 2 -> 4 and index 3 -> 5 are past the end)
    const r = forwardReturns(closes, [0, 2, 3], 2)
    expect(r).toHaveLength(1)
    expect(r[0]).toBeCloseTo(21, 5)
    expect(forwardReturns(closes, [3], 1)).toEqual([])
  })
})

describe('summarize', () => {
  it('computes n, mean, median, win rate and worst case', () => {
    const s = summarize([10, -5, 5, 20], 0)
    expect(s.n).toBe(4)
    expect(s.avg).toBeCloseTo(7.5, 5)
    expect(s.median).toBeCloseTo(7.5, 5)
    expect(s.winRate).toBe(75)
    expect(s.worst).toBe(-5)
  })

  it('subtracts the round-trip cost from every trade before summarizing', () => {
    const s = summarize([1, 0.2], 0.5)
    expect(s.avg).toBeCloseTo(0.1, 5) // net [0.5, -0.3] -> mean 0.1
    expect(s.winRate).toBe(50)
  })

  it('returns zeros for an empty sample instead of NaN', () => {
    expect(summarize([], 0)).toEqual({ n: 0, avg: 0, median: 0, winRate: 0, worst: 0 })
  })
})
