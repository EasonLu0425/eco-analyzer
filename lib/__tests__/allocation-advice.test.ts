import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '@/lib/db'
import { getAllocationAdvice, trendFromCloses } from '@/lib/allocation-advice'
import { setCash, setHolding } from '@/lib/portfolio-store'

const ramp = (n: number, start: number, step: number): number[] => Array.from({ length: n }, (_, i) => start + i * step)

describe('trendFromCloses', () => {
  it('is unknown with fewer than 200 closes', () => {
    expect(trendFromCloses(ramp(150, 100, 1))).toEqual({ aboveMa200: null, ma60Rising: null })
  })

  it('reads a steady climb as above MA200 with MA60 rising', () => {
    expect(trendFromCloses(ramp(260, 100, 1))).toEqual({ aboveMa200: true, ma60Rising: true })
  })

  it('reads a steady decline as below MA200 with MA60 falling', () => {
    expect(trendFromCloses(ramp(260, 400, -1))).toEqual({ aboveMa200: false, ma60Rising: false })
  })
})

describe('getAllocationAdvice', () => {
  let db: Database.Database
  beforeEach(() => {
    db = new Database(':memory:')
    runMigrations(db)
  })

  const addPrices = (ticker: string, closes: number[]) => {
    const stmt = db.prepare('INSERT INTO prices (ticker, date, close) VALUES (?, ?, ?)')
    closes.forEach((c, i) => {
      const d = new Date(Date.UTC(2023, 0, 1) + i * 86_400_000).toISOString().slice(0, 10)
      stmt.run(ticker, d, c)
    })
  }

  it('returns null when nothing is tracked yet', () => {
    expect(getAllocationAdvice(db)).toBeNull()
  })

  it('prices each holding at its latest close and sizes a buy from the budget', () => {
    addPrices('0050.TW', ramp(700, 50, 0.05))
    setCash(100_000, db)
    setHolding({ ticker: '0050.TW', shares: 0, avgCost: 0 }, db)

    const result = getAllocationAdvice(db)!
    expect(result.signal).toBe('hold')            // no report stored -> neutral pace, stated in the result
    expect(result.signalDate).toBeNull()
    expect(result.advice.lines[0].price).toBeCloseTo(50 + 699 * 0.05, 6)
    expect(result.advice.lines[0].action).toBe('buy')
    expect(result.advice.budgetToDeploy).toBeGreaterThan(0)
  })

  it('flags a tracked ticker with no price data instead of throwing', () => {
    addPrices('0050.TW', ramp(700, 50, 0.05))
    setCash(1_000, db)
    setHolding({ ticker: '00878.TW', shares: 10, avgCost: 20 }, db)

    const result = getAllocationAdvice(db)!
    expect(result.advice.lines[0].price).toBeNull()
    expect(result.advice.notes.some(n => n.includes('00878.TW'))).toBe(true)
  })
})
