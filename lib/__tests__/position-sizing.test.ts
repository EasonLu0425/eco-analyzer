import { describe, it, expect } from 'vitest'
import { SIZING, suggestAllocation, type MarketContext, type SizingInput } from '@/lib/position-sizing'

const upNormal: MarketContext = { signal: 'buy', aboveMa200: true, ma60Rising: true, volPercentile: 0.5 }

const input = (over: Partial<SizingInput> = {}): SizingInput => ({
  market: upNormal,
  cash: 100_000,
  positions: [{ ticker: '0050.TW', shares: 0, avgCost: 0, price: 100 }],
  ...over,
})

describe('target exposure', () => {
  it('rises in an uptrend with normal volatility', () => {
    expect(suggestAllocation(input()).targetExposure).toBeCloseTo(SIZING.baseExposure + SIZING.trendUp, 6)
  })

  it('stays at the base when above MA200 but MA60 is falling', () => {
    const a = suggestAllocation(input({ market: { ...upNormal, ma60Rising: false } }))
    expect(a.targetExposure).toBeCloseTo(SIZING.baseExposure, 6)
  })

  it('drops below the base under MA200', () => {
    const a = suggestAllocation(input({ market: { ...upNormal, aboveMa200: false, ma60Rising: false } }))
    expect(a.targetExposure).toBeCloseTo(SIZING.baseExposure + SIZING.trendDown, 6)
  })

  it('adds the volatility adjustment by regime', () => {
    const low = suggestAllocation(input({ market: { ...upNormal, volPercentile: 0.1 } }))
    const extreme = suggestAllocation(input({ market: { ...upNormal, volPercentile: 0.99 } }))
    expect(low.targetExposure).toBeGreaterThan(extreme.targetExposure)
    expect(extreme.targetExposure).toBeCloseTo(SIZING.baseExposure + SIZING.trendUp + SIZING.volAdjust.extreme, 6)
  })

  it('does not change the target with the news signal (direction is unproven)', () => {
    const strongBuy = suggestAllocation(input({ market: { ...upNormal, signal: 'strong-buy' } }))
    const strongAvoid = suggestAllocation(input({ market: { ...upNormal, signal: 'strong-avoid' } }))
    expect(strongBuy.targetExposure).toBe(strongAvoid.targetExposure)
  })

  it('treats unknown trend and volatility as neutral and says so', () => {
    const a = suggestAllocation(input({ market: { signal: 'hold', aboveMa200: null, ma60Rising: null, volPercentile: null } }))
    expect(a.targetExposure).toBeCloseTo(SIZING.baseExposure, 6)
    expect(a.notes.some(n => n.includes('資料不足'))).toBe(true)
  })

  it('lists every factor that moved the target so the advice is explainable', () => {
    const a = suggestAllocation(input())
    expect(a.factors.map(f => f.label)).toEqual(expect.arrayContaining(['基準', '趨勢', '波動']))
    expect(a.factors.reduce((s, f) => s + f.delta, 0)).toBeCloseTo(a.targetExposure, 6)
  })
})

describe('buy sizing', () => {
  it('buys at most one step of total assets toward the target', () => {
    const a = suggestAllocation(input())
    expect(a.budgetToDeploy).toBeCloseTo(100_000 * SIZING.stepFraction, 6)
    expect(a.lines[0]).toMatchObject({ ticker: '0050.TW', action: 'buy', shares: 250, amount: 25_000 })
  })

  it('slows down on a hold signal and pauses on avoid', () => {
    const hold = suggestAllocation(input({ market: { ...upNormal, signal: 'hold' } }))
    const avoid = suggestAllocation(input({ market: { ...upNormal, signal: 'avoid' } }))
    expect(hold.budgetToDeploy).toBeCloseTo(100_000 * SIZING.stepFraction * SIZING.pace.hold, 6)
    expect(avoid.budgetToDeploy).toBe(0)
    expect(avoid.lines[0].action).toBe('hold')
    expect(avoid.notes.some(n => n.includes('暫停'))).toBe(true)
  })

  it('never spends more than the remaining cash', () => {
    const a = suggestAllocation(input({ cash: 5_000, positions: [{ ticker: '0050.TW', shares: 950, avgCost: 90, price: 100 }] }))
    const spent = a.lines.reduce((s, l) => s + (l.action === 'buy' ? l.amount : 0), 0)
    expect(spent).toBeLessThanOrEqual(5_000)
  })

  it('stops buying once the target exposure is reached', () => {
    // 80k held + 20k cash = 80% exposure = target in an uptrend
    const a = suggestAllocation(input({ cash: 20_000, positions: [{ ticker: '0050.TW', shares: 800, avgCost: 90, price: 100 }] }))
    expect(a.budgetToDeploy).toBe(0)
    expect(a.lines[0].action).toBe('hold')
  })

  it('only buys whole shares and reports the exact amount', () => {
    const a = suggestAllocation(input({ positions: [{ ticker: '0050.TW', shares: 0, avgCost: 0, price: 33.3 }] }))
    const l = a.lines[0]
    expect(Number.isInteger(l.shares)).toBe(true)
    expect(l.amount).toBeCloseTo(l.shares * 33.3, 6)
  })

  it('reports no buy when cash is zero', () => {
    const a = suggestAllocation(input({ cash: 0, positions: [{ ticker: '0050.TW', shares: 100, avgCost: 90, price: 100 }] }))
    expect(a.budgetToDeploy).toBe(0)
    expect(a.notes.some(n => n.includes('預算'))).toBe(true)
  })
})

describe('multiple tickers', () => {
  const two = [
    { ticker: '0050.TW', shares: 500, avgCost: 90, price: 100 },     // 50k
    { ticker: '00878.TW', shares: 0, avgCost: 0, price: 20 },        // 0
  ]

  it('targets equal weights and buys only the underweight ticker', () => {
    const a = suggestAllocation(input({ cash: 50_000, positions: two }))
    const l50 = a.lines.find(l => l.ticker === '0050.TW')!
    const l878 = a.lines.find(l => l.ticker === '00878.TW')!
    expect(l50.action).toBe('hold')
    expect(l878.action).toBe('buy')
    expect(l878.shares).toBeGreaterThan(0)
  })

  it('splits the budget across underweight tickers in proportion to their gaps', () => {
    const a = suggestAllocation(input({
      cash: 100_000,
      positions: [
        { ticker: '0050.TW', shares: 0, avgCost: 0, price: 100 },
        { ticker: '00878.TW', shares: 0, avgCost: 0, price: 20 },
      ],
    }))
    const [x, y] = a.lines.map(l => l.amount)
    expect(x).toBeCloseTo(y, -2)   // equal gaps -> equal money, up to share rounding
  })
})

describe('exposure cap on buys', () => {
  const down: MarketContext = { signal: 'buy', aboveMa200: false, ma60Rising: false, volPercentile: 0.5 }   // target 50%

  it('never buys past the target when another ticker is overweight', () => {
    // A 55k + cash 45k, B 0: exposure 55% (inside the band, no trim), B's own gap is 25k
    const a = suggestAllocation(input({
      market: down,
      cash: 45_000,
      positions: [
        { ticker: '0050.TW', shares: 550, avgCost: 90, price: 100 },
        { ticker: '00878.TW', shares: 0, avgCost: 0, price: 20 },
      ],
    }))
    const bought = a.lines.reduce((s, l) => s + (l.action === 'buy' ? l.amount : 0), 0)
    // 55% is already above the 50% target (inside the trim band): buying anything would widen the gap
    expect(bought).toBe(0)
    expect(a.budgetToDeploy).toBe(0)
    expect(a.lines.every(l => l.action === 'hold')).toBe(true)
  })
})

describe('unpriced positions', () => {
  it('refuses to size when a held position has no price, instead of understating total assets', () => {
    const a = suggestAllocation(input({
      positions: [
        { ticker: '0050.TW', shares: 0, avgCost: 0, price: 100 },
        { ticker: '00692.TW', shares: 500, avgCost: 40, price: null },
      ],
    }))
    expect(a.budgetToDeploy).toBe(0)
    expect(a.lines.every(l => l.action === 'hold')).toBe(true)
    expect(a.notes.some(n => n.includes('00692.TW') && n.includes('報價'))).toBe(true)
  })

  it('leaves a watch-only unpriced ticker out of the equal split', () => {
    const withGhost = suggestAllocation(input({
      positions: [
        { ticker: '0050.TW', shares: 0, avgCost: 0, price: 100 },
        { ticker: '00878.TW', shares: 0, avgCost: 0, price: null },
      ],
    }))
    const alone = suggestAllocation(input())
    expect(withGhost.lines.find(l => l.ticker === '0050.TW')!.shares).toBe(alone.lines[0].shares)
  })
})

describe('trimming', () => {
  const down2: MarketContext = { signal: 'avoid', aboveMa200: false, ma60Rising: false, volPercentile: 0.5 }

  it('trims even when the signal pauses buying, and splits the trim across overweight tickers', () => {
    const a = suggestAllocation(input({
      market: down2,
      cash: 10_000,
      positions: [
        { ticker: '0050.TW', shares: 600, avgCost: 90, price: 100 },     // 60k
        { ticker: '00692.TW', shares: 3000, avgCost: 20, price: 10 },    // 30k
      ],
    }))
    expect(a.currentExposure).toBeCloseTo(0.9, 6)
    const trims = a.lines.filter(l => l.action === 'trim')
    expect(trims).toHaveLength(2)
    expect(trims.reduce((s, l) => s + l.amount, 0)).toBeLessThanOrEqual(100_000 * SIZING.stepFraction)
    expect(trims[0].amount).toBeGreaterThan(trims[1].amount)   // larger overweight sells more
  })

  it('does not trim when exposure exceeds the target by exactly the band', () => {
    // target 50% (downtrend), exposure 60%
    const a = suggestAllocation(input({ market: down2, cash: 40_000, positions: [{ ticker: '0050.TW', shares: 600, avgCost: 90, price: 100 }] }))
    expect(a.lines[0].action).toBe('hold')
  })

  const heavy = { positions: [{ ticker: '0050.TW', shares: 900, avgCost: 90, price: 100 }], cash: 10_000 }
  const down: MarketContext = { signal: 'hold', aboveMa200: false, ma60Rising: false, volPercentile: 0.5 }

  it('suggests trimming when exposure exceeds target by more than the band', () => {
    const a = suggestAllocation(input({ ...heavy, market: down }))
    expect(a.currentExposure).toBeCloseTo(0.9, 6)
    expect(a.lines[0].action).toBe('trim')
    expect(a.lines[0].amount).toBeLessThanOrEqual(100_000 * SIZING.stepFraction + 100)
  })

  it('does not trim inside the rebalance band', () => {
    const a = suggestAllocation(input({ positions: [{ ticker: '0050.TW', shares: 850, avgCost: 90, price: 100 }], cash: 15_000 }))
    expect(a.lines[0].action).not.toBe('trim')
  })

  it('never trims more shares than are held', () => {
    const a = suggestAllocation(input({ positions: [{ ticker: '0050.TW', shares: 3, avgCost: 90, price: 100 }], cash: 0, market: { ...down, volPercentile: 0.99 } }))
    expect(a.lines[0].shares).toBeLessThanOrEqual(3)
  })
})

describe('edge cases', () => {
  it('returns no lines and a note when nothing is tracked', () => {
    const a = suggestAllocation(input({ positions: [] }))
    expect(a.lines).toEqual([])
    expect(a.notes.some(n => n.includes('庫存'))).toBe(true)
  })

  it('returns no action when total assets are zero', () => {
    const a = suggestAllocation(input({ cash: 0, positions: [{ ticker: '0050.TW', shares: 0, avgCost: 0, price: 100 }] }))
    expect(a.budgetToDeploy).toBe(0)
    expect(a.lines[0].action).toBe('hold')
  })

  it('holds a ticker with no price and explains why', () => {
    const a = suggestAllocation(input({ positions: [{ ticker: '0050.TW', shares: 100, avgCost: 90, price: null }] }))
    expect(a.lines[0].action).toBe('hold')
    expect(a.notes.some(n => n.includes('0050.TW') && n.includes('報價'))).toBe(true)
  })

  it('reports unrealized return per line', () => {
    const a = suggestAllocation(input({ positions: [{ ticker: '0050.TW', shares: 100, avgCost: 80, price: 100 }] }))
    expect(a.lines[0].pnlPct).toBeCloseTo(0.25, 6)
  })

  it('does not mutate its input', () => {
    const frozen = Object.freeze({
      market: Object.freeze({ ...upNormal }),
      cash: 100_000,
      positions: Object.freeze([Object.freeze({ ticker: '0050.TW', shares: 0, avgCost: 0, price: 100 })]),
    })
    expect(() => suggestAllocation(frozen as unknown as SizingInput)).not.toThrow()
  })
})
