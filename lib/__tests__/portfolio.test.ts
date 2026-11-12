import { describe, it, expect } from 'vitest'
import {
  applyTrade, cashDelta, positionPnl, parseHoldingInput, parseTradeInput, parseMoney,
} from '@/lib/portfolio'

const trade = (over: Record<string, unknown> = {}) => ({
  ticker: '0050.TW', side: 'buy', shares: 100, price: 60, fee: 0, date: '2026-11-12', ...over,
})

describe('applyTrade', () => {
  it('opens a position at the trade price when none exists', () => {
    const pos = applyTrade(null, parseTradeInput(trade()))
    expect(pos).toEqual({ ticker: '0050.TW', shares: 100, avgCost: 60 })
  })

  it('blends the average cost on an additional buy', () => {
    const pos = applyTrade({ ticker: '0050.TW', shares: 100, avgCost: 60 }, parseTradeInput(trade({ shares: 300, price: 80 })))
    expect(pos.shares).toBe(400)
    expect(pos.avgCost).toBeCloseTo(75, 6)
  })

  it('adds the buy fee into the cost basis', () => {
    const pos = applyTrade(null, parseTradeInput(trade({ shares: 100, price: 60, fee: 20 })))
    expect(pos.avgCost).toBeCloseTo(60.2, 6)
  })

  it('keeps the average cost unchanged on a partial sell', () => {
    const pos = applyTrade({ ticker: '0050.TW', shares: 400, avgCost: 75 }, parseTradeInput(trade({ side: 'sell', shares: 150, price: 90 })))
    expect(pos).toEqual({ ticker: '0050.TW', shares: 250, avgCost: 75 })
  })

  it('zeroes the cost when everything is sold', () => {
    const pos = applyTrade({ ticker: '0050.TW', shares: 100, avgCost: 60 }, parseTradeInput(trade({ side: 'sell', shares: 100 })))
    expect(pos).toEqual({ ticker: '0050.TW', shares: 0, avgCost: 0 })
  })

  it('rejects selling more than is held', () => {
    expect(() => applyTrade({ ticker: '0050.TW', shares: 50, avgCost: 60 }, parseTradeInput(trade({ side: 'sell', shares: 51 }))))
      .toThrow(/持有/)
    expect(() => applyTrade(null, parseTradeInput(trade({ side: 'sell' })))).toThrow(/持有/)
  })

  it('does not mutate the input position', () => {
    const before = Object.freeze({ ticker: '0050.TW', shares: 100, avgCost: 60 })
    expect(() => applyTrade(before, parseTradeInput(trade()))).not.toThrow()
    expect(before.shares).toBe(100)
  })
})

describe('cashDelta', () => {
  it('spends price x shares plus fee on a buy', () => {
    expect(cashDelta(parseTradeInput(trade({ shares: 100, price: 60, fee: 20 })))).toBe(-6020)
  })

  it('receives price x shares minus fee on a sell', () => {
    expect(cashDelta(parseTradeInput(trade({ side: 'sell', shares: 100, price: 60, fee: 20 })))).toBe(5980)
  })
})

describe('positionPnl', () => {
  it('computes market value, cost basis and unrealized return', () => {
    const p = positionPnl({ ticker: '0050.TW', shares: 100, avgCost: 60 }, 69)
    expect(p).toEqual({ marketValue: 6900, costBasis: 6000, pnl: 900, pnlPct: 0.15 })
  })

  it('returns null return when there is no cost basis or no price', () => {
    expect(positionPnl({ ticker: '0050.TW', shares: 0, avgCost: 0 }, 69).pnlPct).toBeNull()
    expect(positionPnl({ ticker: '0050.TW', shares: 100, avgCost: 60 }, null)).toEqual({ marketValue: null, costBasis: 6000, pnl: null, pnlPct: null })
  })
})

describe('parseHoldingInput', () => {
  it('accepts a valid holding', () => {
    expect(parseHoldingInput({ ticker: '0050.TW', shares: 1000, avgCost: 58.5 })).toEqual({ ticker: '0050.TW', shares: 1000, avgCost: 58.5 })
  })

  it('accepts OTC-listed tickers (.TWO)', () => {
    expect(parseHoldingInput({ ticker: '006201.TWO', shares: 1, avgCost: 10 }).ticker).toBe('006201.TWO')
  })

  it('accepts zero shares as a watched ticker and forces cost to zero', () => {
    expect(parseHoldingInput({ ticker: '00878.TW', shares: 0, avgCost: 0 })).toEqual({ ticker: '00878.TW', shares: 0, avgCost: 0 })
  })

  it.each([
    [{ ticker: 'AAPL', shares: 1, avgCost: 1 }, /代號/],
    [{ ticker: '0050.TW', shares: 1.5, avgCost: 1 }, /股數/],
    [{ ticker: '0050.TW', shares: -1, avgCost: 1 }, /股數/],
    [{ ticker: '0050.TW', shares: 10, avgCost: 0 }, /成本/],
    [{ ticker: '0050.TW', shares: 10, avgCost: -5 }, /成本/],
    [{ ticker: '0050.TW', shares: 10, avgCost: Number.NaN }, /成本/],
    [{ ticker: '0050.TW', shares: '10', avgCost: 5 }, /股數/],
    [null, /物件/],
  ])('rejects invalid input %j', (input, message) => {
    expect(() => parseHoldingInput(input)).toThrow(message)
  })
})

describe('parseTradeInput', () => {
  it('normalizes a valid trade', () => {
    expect(parseTradeInput(trade())).toEqual({ ticker: '0050.TW', side: 'buy', shares: 100, price: 60, fee: 0, date: '2026-11-12' })
  })

  it('defaults fee to zero when omitted', () => {
    const rest: Record<string, unknown> = trade()
    delete rest.fee
    expect(parseTradeInput(rest).fee).toBe(0)
  })

  it.each([
    [{ side: 'hold' }, /買賣/],
    [{ shares: 0 }, /股數/],
    [{ shares: 2.5 }, /股數/],
    [{ price: 0 }, /價格/],
    [{ price: -1 }, /價格/],
    [{ fee: -1 }, /手續費/],
    [{ date: '2026-13-40' }, /日期/],
    [{ date: '11/12' }, /日期/],
    [{ date: '2026-02-31' }, /日期/],
    [{ date: '2026-04-31' }, /日期/],
    [{ ticker: '0050' }, /代號/],
  ])('rejects invalid field %j', (over, message) => {
    expect(() => parseTradeInput(trade(over))).toThrow(message)
  })
})

describe('cashDelta rounding', () => {
  it('returns whole dollars so fractional prices do not leave float dust in the budget', () => {
    expect(cashDelta(parseTradeInput(trade({ shares: 3, price: 33.33, fee: 0.15 })))).toBe(-100)
    expect(Number.isInteger(cashDelta(parseTradeInput(trade({ side: 'sell', shares: 7, price: 12.345 }))))).toBe(true)
  })
})

describe('parseMoney', () => {
  it('accepts finite numbers and rounds to whole dollars', () => {
    expect(parseMoney(1000.4, '預算')).toBe(1000)
    expect(parseMoney(-500, '調整金額')).toBe(-500)
  })

  it.each([['100'], [Number.NaN], [Infinity], [1e13], [null]])('rejects %j', v => {
    expect(() => parseMoney(v, '預算')).toThrow(/預算/)
  })
})
