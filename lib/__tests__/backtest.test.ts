import { describe, it, expect } from 'vitest'
import { runBacktest } from '@/lib/backtest'

function makeReports(entries: { date: string; signal: string }[]) {
  return entries as { date: string; signal: import('@/types').ETFSignal }[]
}

function makePrices(entries: [string, number][]): Map<string, number> {
  return new Map(entries)
}

describe('runBacktest', () => {
  it('creates a trade when buy signal is followed by avoid signal', () => {
    const reports = makeReports([
      { date: '2026-01-01', signal: 'buy' },
      { date: '2026-01-03', signal: 'avoid' },
    ])
    const prices = makePrices([
      ['2026-01-01', 100],
      ['2026-01-02', 110],
      ['2026-01-03', 105],
    ])
    const result = runBacktest(reports, prices, '0050.TW')
    expect(result.tradeCount).toBe(1)
    expect(result.trades[0].entryPrice).toBe(100)
    expect(result.trades[0].exitPrice).toBe(105)
    expect(result.trades[0].returnPct).toBeCloseTo(5, 4)
  })

  it('equity curve starts at 100', () => {
    const reports = makeReports([{ date: '2026-01-01', signal: 'hold' }])
    const prices = makePrices([['2026-01-01', 100]])
    const result = runBacktest(reports, prices, '0050.TW')
    expect(result.equityCurve[0].value).toBe(100)
  })

  it('equity rises during a winning trade', () => {
    const reports = makeReports([
      { date: '2026-01-01', signal: 'buy' },
      { date: '2026-01-03', signal: 'avoid' },
    ])
    const prices = makePrices([
      ['2026-01-01', 100],
      ['2026-01-02', 120],
      ['2026-01-03', 110],
    ])
    const result = runBacktest(reports, prices, '0050.TW')
    expect(result.equityCurve[1].value).toBeGreaterThan(100)
  })

  it('returns zero trades and zero return when no buy signal', () => {
    const reports = makeReports([{ date: '2026-01-01', signal: 'hold' }])
    const prices = makePrices([['2026-01-01', 100]])
    const result = runBacktest(reports, prices, '0050.TW')
    expect(result.tradeCount).toBe(0)
    expect(result.totalReturn).toBe(0)
  })

  it('winRate is 100 for all-winning trades', () => {
    const reports = makeReports([
      { date: '2026-01-01', signal: 'buy' },
      { date: '2026-01-05', signal: 'avoid' },
    ])
    const prices = makePrices([
      ['2026-01-01', 100],
      ['2026-01-02', 110],
      ['2026-01-03', 120],
      ['2026-01-04', 130],
      ['2026-01-05', 140],
    ])
    const result = runBacktest(reports, prices, '0050.TW')
    expect(result.winRate).toBe(100)
  })

  it('maxDrawdown is positive when equity declines during trade', () => {
    const reports = makeReports([
      { date: '2026-01-01', signal: 'buy' },
      { date: '2026-01-04', signal: 'avoid' },
    ])
    const prices = makePrices([
      ['2026-01-01', 100],
      ['2026-01-02', 80],
      ['2026-01-03', 70],
      ['2026-01-04', 90],
    ])
    const result = runBacktest(reports, prices, '0050.TW')
    expect(result.maxDrawdown).toBeGreaterThan(0)
  })

  it('closes open position at last available price', () => {
    const reports = makeReports([{ date: '2026-01-01', signal: 'strong-buy' }])
    const prices = makePrices([
      ['2026-01-01', 100],
      ['2026-01-02', 110],
    ])
    const result = runBacktest(reports, prices, '0050.TW')
    expect(result.tradeCount).toBe(1)
    expect(result.trades[0].exitPrice).toBe(110)
  })

  it('result contains correct ticker', () => {
    const result = runBacktest([], new Map(), '0050.TW')
    expect(result.ticker).toBe('0050.TW')
  })
})
