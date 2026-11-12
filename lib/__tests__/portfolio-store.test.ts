import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '@/lib/db'
import {
  adjustCash, getCash, getHoldings, getPortfolio, getTrades, recordTrade, removeHolding, setCash, setHolding,
} from '@/lib/portfolio-store'

let db: Database.Database

beforeEach(() => {
  db = new Database(':memory:')
  runMigrations(db)
})

const trade = (over: Record<string, unknown> = {}) => ({
  ticker: '0050.TW', side: 'buy', shares: 100, price: 60, fee: 0, date: '2026-11-12', ...over,
})

describe('cash', () => {
  it('starts at zero', () => {
    expect(getCash(db)).toBe(0)
  })

  it('can be set, increased and decreased', () => {
    setCash(100_000, db)
    adjustCash(25_000, db)
    adjustCash(-10_000, db)
    expect(getCash(db)).toBe(115_000)
  })

  it('refuses to go negative', () => {
    setCash(1_000, db)
    expect(() => adjustCash(-1_001, db)).toThrow(/預算/)
    expect(getCash(db)).toBe(1_000)
    expect(() => setCash(-1, db)).toThrow(/預算/)
  })
})

describe('cash upper bound', () => {
  it('rejects a balance above the cap instead of drifting past safe-integer precision', () => {
    setCash(900_000_000_000, db)
    expect(() => adjustCash(900_000_000_000, db)).toThrow(/預算/)
    expect(getCash(db)).toBe(900_000_000_000)
  })
})

describe('holdings', () => {
  it('stores and updates a holding by ticker', () => {
    setHolding({ ticker: '0050.TW', shares: 1000, avgCost: 58 }, db)
    setHolding({ ticker: '0050.TW', shares: 1200, avgCost: 59 }, db)
    expect(getHoldings(db)).toEqual([{ ticker: '0050.TW', shares: 1200, avgCost: 59 }])
  })

  it('does not touch cash when a holding is edited directly', () => {
    setCash(5_000, db)
    setHolding({ ticker: '0050.TW', shares: 1000, avgCost: 58 }, db)
    expect(getCash(db)).toBe(5_000)
  })

  it('removes a holding and lists the rest in ticker order', () => {
    setHolding({ ticker: '00878.TW', shares: 10, avgCost: 20 }, db)
    setHolding({ ticker: '0050.TW', shares: 10, avgCost: 60 }, db)
    removeHolding('00878.TW', db)
    expect(getHoldings(db).map(h => h.ticker)).toEqual(['0050.TW'])
  })

  it('rejects an invalid holding without writing', () => {
    expect(() => setHolding({ ticker: 'bad', shares: 1, avgCost: 1 }, db)).toThrow()
    expect(getHoldings(db)).toEqual([])
  })
})

describe('recordTrade', () => {
  it('buy lowers cash, raises shares and blends cost, and logs the trade', () => {
    setCash(100_000, db)
    setHolding({ ticker: '0050.TW', shares: 100, avgCost: 60 }, db)
    recordTrade(trade({ shares: 300, price: 80 }), db)

    expect(getHoldings(db)).toEqual([{ ticker: '0050.TW', shares: 400, avgCost: 75 }])
    expect(getCash(db)).toBe(100_000 - 24_000)
    expect(getTrades(10, db)).toHaveLength(1)
  })

  it('sell raises cash and lowers shares', () => {
    setCash(0, db)
    setHolding({ ticker: '0050.TW', shares: 400, avgCost: 75 }, db)
    recordTrade(trade({ side: 'sell', shares: 100, price: 90, fee: 20 }), db)

    expect(getHoldings(db)[0].shares).toBe(300)
    expect(getCash(db)).toBe(8_980)
  })

  it('rejects a buy that exceeds the budget and leaves everything unchanged', () => {
    setCash(1_000, db)
    expect(() => recordTrade(trade(), db)).toThrow(/預算/)
    expect(getHoldings(db)).toEqual([])
    expect(getCash(db)).toBe(1_000)
    expect(getTrades(10, db)).toEqual([])
  })

  it('rejects selling more than held and leaves everything unchanged', () => {
    setHolding({ ticker: '0050.TW', shares: 10, avgCost: 60 }, db)
    expect(() => recordTrade(trade({ side: 'sell', shares: 11 }), db)).toThrow(/持有/)
    expect(getHoldings(db)[0].shares).toBe(10)
    expect(getTrades(10, db)).toEqual([])
  })

  it('keeps a sold-out ticker as a watched row with zero shares', () => {
    setHolding({ ticker: '0050.TW', shares: 10, avgCost: 60 }, db)
    recordTrade(trade({ side: 'sell', shares: 10 }), db)
    expect(getHoldings(db)).toEqual([{ ticker: '0050.TW', shares: 0, avgCost: 0 }])
  })

  it('returns newest trades first', () => {
    setCash(1_000_000, db)
    recordTrade(trade({ date: '2026-11-10' }), db)
    recordTrade(trade({ date: '2026-11-12' }), db)
    expect(getTrades(10, db).map(t => t.date)).toEqual(['2026-11-12', '2026-11-10'])
  })
})

describe('getPortfolio', () => {
  it('bundles cash and holdings', () => {
    setCash(500, db)
    setHolding({ ticker: '0050.TW', shares: 1, avgCost: 60 }, db)
    expect(getPortfolio(db)).toEqual({ cash: 500, holdings: [{ ticker: '0050.TW', shares: 1, avgCost: 60 }] })
  })
})
