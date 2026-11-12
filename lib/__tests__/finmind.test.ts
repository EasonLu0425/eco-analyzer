import { describe, it, expect } from 'vitest'
import { parseInstitutional, parseMarginBalance, parseRevenueYoy } from '@/lib/finmind'

describe('parseInstitutional', () => {
  const rows = [
    { date: '2026-01-02', name: 'Foreign_Investor', buy: 100, sell: 40 },
    { date: '2026-01-02', name: 'Foreign_Dealer_Self', buy: 5, sell: 0 },
    { date: '2026-01-02', name: 'Investment_Trust', buy: 10, sell: 30 },
    { date: '2026-01-02', name: 'Dealer_self', buy: 7, sell: 2 },
    { date: '2026-01-02', name: 'Dealer_Hedging', buy: 20, sell: 25 },
    { date: '2026-01-02', name: 'total', buy: 999, sell: 1 },
  ]

  it('nets buy minus sell and groups foreign / trust / dealer', () => {
    const out = parseInstitutional(rows)
    expect(out.inst_foreign_net).toEqual([{ date: '2026-01-02', value: 65 }])
    expect(out.inst_trust_net).toEqual([{ date: '2026-01-02', value: -20 }])
    expect(out.inst_dealer_net).toEqual([{ date: '2026-01-02', value: 0 }]) // (7-2) + (20-25)
  })

  it('ignores the pre-aggregated total row and returns dates in ascending order', () => {
    const out = parseInstitutional([
      { date: '2026-01-05', name: 'Foreign_Investor', buy: 3, sell: 1 },
      ...rows,
    ])
    expect(out.inst_foreign_net.map(p => p.date)).toEqual(['2026-01-02', '2026-01-05'])
  })

  it('returns empty series for empty input', () => {
    expect(parseInstitutional([])).toEqual({ inst_foreign_net: [], inst_trust_net: [], inst_dealer_net: [] })
  })
})

describe('parseMarginBalance', () => {
  it('keeps only the margin-purchase money balance', () => {
    const out = parseMarginBalance([
      { date: '2026-01-02', name: 'MarginPurchase', TodayBalance: 8_500_000 },
      { date: '2026-01-02', name: 'MarginPurchaseMoney', TodayBalance: 130_000_000_000 },
      { date: '2026-01-02', name: 'ShortSale', TodayBalance: 400_000 },
    ])
    expect(out).toEqual([{ date: '2026-01-02', value: 130_000_000_000 }])
  })
})

describe('parseRevenueYoy', () => {
  const rev = (year: number, month: number, revenue: number) => ({ revenue_year: year, revenue_month: month, revenue })

  it('computes year-over-year growth and dates it at the 10th of the following month', () => {
    const out = parseRevenueYoy([rev(2025, 1, 100), rev(2026, 1, 130)])
    expect(out).toHaveLength(1)
    expect(out[0].date).toBe('2026-02-10')
    expect(out[0].value).toBeCloseTo(0.3, 6)
  })

  it('rolls December revenue into January 10 of the next year', () => {
    const out = parseRevenueYoy([rev(2024, 12, 200), rev(2025, 12, 150)])
    expect(out[0].date).toBe('2026-01-10')
    expect(out[0].value).toBeCloseTo(-0.25, 6)
  })

  it('skips months whose year-ago month is missing and tolerates unsorted input', () => {
    const out = parseRevenueYoy([rev(2026, 2, 120), rev(2025, 1, 100), rev(2026, 1, 110), rev(2025, 2, 0)])
    expect(out.map(p => p.date)).toEqual(['2026-02-10']) // Feb has a zero base -> skipped
    expect(out[0].value).toBeCloseTo(0.1, 6)
  })
})
