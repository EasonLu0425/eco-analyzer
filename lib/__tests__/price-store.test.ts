import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import type { PriceRecord } from '@/types'
import { runMigrations } from '@/lib/db'
import { getPriceHistory, getPriceTrend } from '@/lib/price-store'

function makeDb() {
  const db = new Database(':memory:')
  runMigrations(db)
  return db
}

function seedPrices(db: Database.Database, ticker: string, records: PriceRecord[]) {
  const insert = db.prepare(
    'INSERT INTO prices (ticker, date, open, high, low, close, volume) VALUES (?, ?, ?, ?, ?, ?, ?)',
  )
  db.transaction(() => {
    for (const r of records) insert.run(ticker, r.date, r.open, r.high, r.low, r.close, r.volume)
  })()
}

function makeHistory(days: number, endDateStr: string, baseClose = 100): PriceRecord[] {
  const records: PriceRecord[] = []
  const end = new Date(endDateStr)
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end)
    d.setDate(d.getDate() - i)
    records.push({
      date: d.toISOString().slice(0, 10),
      open: baseClose - 1,
      high: baseClose + 2,
      low: baseClose - 3,
      close: baseClose + (days - 1 - i) * 0.1,
      volume: 100000,
    })
  }
  return records
}

describe('getPriceHistory', () => {
  let db: Database.Database

  beforeEach(() => { db = makeDb() })

  it('returns last N days of records sorted ascending', () => {
    const records = makeHistory(200, '2026-06-09')
    seedPrices(db, 'QQQ', records)

    const result = getPriceHistory('QQQ', 30, db)

    expect(result).toHaveLength(30)
    expect(result[0].date < result[29].date).toBe(true)
  })

  it('returns all records when requested days exceeds available', () => {
    const records = makeHistory(10, '2026-06-09')
    seedPrices(db, 'QQQ', records)

    const result = getPriceHistory('QQQ', 90, db)

    expect(result).toHaveLength(10)
  })

  it('returns empty array when no data for ticker', () => {
    const result = getPriceHistory('MISSING', 30, db)
    expect(result).toEqual([])
  })

  it('excludes records after asOfDate when provided', () => {
    const records = makeHistory(200, '2026-06-09')
    seedPrices(db, 'QQQ', records)

    const result = getPriceHistory('QQQ', 30, db, '2026-05-01')

    expect(result).toHaveLength(30)
    expect(result.every(r => r.date <= '2026-05-01')).toBe(true)
  })
})

describe('getPriceTrend', () => {
  let db: Database.Database

  beforeEach(() => { db = makeDb() })

  it('calculates 30d and 90d change correctly', () => {
    const records = makeHistory(120, '2026-06-09', 90)
    seedPrices(db, 'QQQ', records)

    const trend = getPriceTrend('QQQ', db)

    expect(trend).not.toBeNull()
    expect(trend!.currentClose).toBeTypeOf('number')
    expect(trend!.change30d).toBeTypeOf('number')
    expect(trend!.change90d).toBeTypeOf('number')
  })

  it('includes 52-week high and low', () => {
    const records = makeHistory(365, '2026-06-09', 50)
    records[100].high = 200
    records[200].low = 10
    seedPrices(db, 'QQQ', records)

    const trend = getPriceTrend('QQQ', db)

    expect(trend!.high52w).toBe(200)
    expect(trend!.low52w).toBe(10)
  })

  it('returns null when fewer than 31 records', () => {
    const records = makeHistory(5, '2026-06-09')
    seedPrices(db, 'QQQ', records)

    const trend = getPriceTrend('QQQ', db)

    expect(trend).toBeNull()
  })

  it('computes trend as of a historical date, ignoring later records', () => {
    const records = makeHistory(120, '2026-06-09', 90)
    seedPrices(db, 'QQQ', records)

    const asOfDate = '2026-05-01'
    const trend = getPriceTrend('QQQ', db, asOfDate)
    const liveTrend = getPriceTrend('QQQ', db)

    expect(trend).not.toBeNull()
    expect(trend!.currentClose).not.toBe(liveTrend!.currentClose)

    const asOfRow = records.find(r => r.date === asOfDate)!
    expect(trend!.currentClose).toBe(asOfRow.close)
  })

  it('returns null when fewer than 31 records exist as of the given date', () => {
    const records = makeHistory(120, '2026-06-09', 90)
    seedPrices(db, 'QQQ', records)

    const trend = getPriceTrend('QQQ', db, records[10].date)

    expect(trend).toBeNull()
  })
})
