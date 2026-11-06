import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import type { PriceRecord } from '@/types'
import { runMigrations } from '@/lib/db'
import { countTradingDays, getPriceHistory, getPriceTrend } from '@/lib/price-store'

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

describe('countTradingDays', () => {
  let db: Database.Database

  beforeEach(() => {
    db = makeDb()
  })

  const rec = (date: string): PriceRecord => ({
    date, open: 100, high: 101, low: 99, close: 100, volume: 1000,
  })

  it('returns 0 when no price rows exist in range', () => {
    expect(countTradingDays('2026-10-01', '2026-10-31', db)).toBe(0)
  })

  it('counts distinct dates across tickers (union), not rows', () => {
    seedPrices(db, '0050.TW', [rec('2026-10-01'), rec('2026-10-02')])
    seedPrices(db, '^TWII', [rec('2026-10-02'), rec('2026-10-05')])
    expect(countTradingDays('2026-10-01', '2026-10-31', db)).toBe(3)
  })

  it('respects the inclusive date range', () => {
    seedPrices(db, '0050.TW', [rec('2026-09-30'), rec('2026-10-01'), rec('2026-10-31'), rec('2026-11-02')])
    expect(countTradingDays('2026-10-01', '2026-10-31', db)).toBe(2)
  })

  it('ignores non-Taiwan market tickers such as ^GSPC', () => {
    seedPrices(db, '^GSPC', [rec('2026-10-01'), rec('2026-10-02')])
    seedPrices(db, '0050.TW', [rec('2026-10-01')])
    expect(countTradingDays('2026-10-01', '2026-10-31', db)).toBe(1)
  })
})
