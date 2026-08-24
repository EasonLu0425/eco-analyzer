import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '@/lib/db'
import { computeCorrelation } from '@/lib/correlation'

function makeDb() {
  const db = new Database(':memory:')
  runMigrations(db)
  return db
}

function seedPrices(db: Database.Database, ticker: string, closes: number[]) {
  const insert = db.prepare(
    'INSERT INTO prices (ticker, date, open, high, low, close, volume) VALUES (?, ?, ?, ?, ?, ?, ?)',
  )
  db.transaction(() => {
    closes.forEach((c, i) => {
      const d = new Date('2026-01-01')
      d.setDate(d.getDate() + i)
      insert.run(ticker, d.toISOString().slice(0, 10), c, c + 1, c - 1, c, 1000)
    })
  })()
}

describe('computeCorrelation', () => {
  let db: Database.Database

  beforeEach(() => {
    db = makeDb()
  })

  it('returns null when insufficient data', () => {
    seedPrices(db, 'A', [100])
    seedPrices(db, 'B', [100])
    expect(computeCorrelation('A', 'B', 30, db)).toBeNull()
  })

  it('returns ~1 for identical series', () => {
    const closes = Array.from({ length: 35 }, (_, i) => 100 + i)
    seedPrices(db, 'A', closes)
    seedPrices(db, 'B', closes)
    const result = computeCorrelation('A', 'B', 30, db)
    expect(result).not.toBeNull()
    expect(result!.correlation).toBeCloseTo(1, 2)
  })

  it('returns negative correlation for inverse-return series', () => {
    // Alternating up/down for A, down/up for B → log returns exactly anti-correlated
    const n = 35
    const aCloses = Array.from({ length: n }, (_, i) => (i % 2 === 0 ? 100 : 110))
    const bCloses = Array.from({ length: n }, (_, i) => (i % 2 === 0 ? 100 : 90))
    seedPrices(db, 'A', aCloses)
    seedPrices(db, 'B', bCloses)
    const result = computeCorrelation('A', 'B', 30, db)
    expect(result).not.toBeNull()
    expect(result!.correlation).toBeLessThan(0)
  })

  it('returns null when tickers have no overlapping dates', () => {
    const db2 = makeDb()
    const insert = db2.prepare(
      'INSERT INTO prices (ticker, date, open, high, low, close, volume) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    insert.run('A', '2026-01-01', 100, 101, 99, 100, 1000)
    insert.run('B', '2026-02-01', 100, 101, 99, 100, 1000)
    expect(computeCorrelation('A', 'B', 30, db2)).toBeNull()
  })

  it('result has correct shape', () => {
    const closes = Array.from({ length: 35 }, (_, i) => 100 + i)
    seedPrices(db, 'X', closes)
    seedPrices(db, 'Y', closes)
    const result = computeCorrelation('X', 'Y', 30, db)
    expect(result).toMatchObject({
      ticker: 'X',
      correlation: expect.any(Number),
      period: expect.any(Number),
      fromDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      toDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    })
  })

  it('excludes records after asOfDate when provided', () => {
    const closes = Array.from({ length: 35 }, (_, i) => 100 + i)
    seedPrices(db, 'A', closes)
    seedPrices(db, 'B', closes)

    // 2026-01-01 + 20 days = 2026-01-21, well before the full 35-day series ends
    const asOfDate = '2026-01-21'
    const result = computeCorrelation('A', 'B', 30, db, asOfDate)

    expect(result).not.toBeNull()
    expect(result!.toDate <= asOfDate).toBe(true)
  })
})
