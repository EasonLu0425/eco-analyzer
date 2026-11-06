import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import type { IntradayQuote } from '@/types'
import { runMigrations } from '@/lib/db'
import { getIntradayQuotes, hasMarketQuoteForDate, saveIntradayQuotes } from '@/lib/intraday-store'

function makeDb() {
  const db = new Database(':memory:')
  runMigrations(db)
  return db
}

const quote = (ticker: string, price: number, marketDate = '2026-11-06'): IntradayQuote => ({
  ticker,
  price,
  open: price - 1,
  high: price + 1,
  low: price - 2,
  volume: 1000,
  prevClose: price - 0.5,
  marketTime: `${marketDate}T03:00:00.000Z`,
})

describe('intraday-store', () => {
  let db: Database.Database

  beforeEach(() => {
    db = makeDb()
  })

  it('saves and reads quotes for a date and session', () => {
    saveIntradayQuotes('2026-11-06', 'midday', [quote('0050.TW', 98), quote('^TWII', 42000)], '2026-11-06T11:00:00+08:00', db)
    const rows = getIntradayQuotes('2026-11-06', 'midday', db)
    expect(rows.map(r => r.ticker).sort()).toEqual(['0050.TW', '^TWII'])
    expect(rows.find(r => r.ticker === '0050.TW')?.price).toBe(98)
  })

  it('replaces the same (ticker, date, session) on re-run instead of duplicating', () => {
    saveIntradayQuotes('2026-11-06', 'midday', [quote('0050.TW', 98)], 't1', db)
    saveIntradayQuotes('2026-11-06', 'midday', [quote('0050.TW', 99)], 't2', db)
    const rows = getIntradayQuotes('2026-11-06', 'midday', db)
    expect(rows).toHaveLength(1)
    expect(rows[0].price).toBe(99)
  })

  it('keeps different sessions separate and lists all when session is omitted', () => {
    saveIntradayQuotes('2026-11-06', 'midday', [quote('0050.TW', 98)], 't1', db)
    saveIntradayQuotes('2026-11-06', 'close', [quote('0050.TW', 97)], 't2', db)
    expect(getIntradayQuotes('2026-11-06', 'close', db)).toHaveLength(1)
    expect(getIntradayQuotes('2026-11-06', undefined, db)).toHaveLength(2)
  })

  describe('hasMarketQuoteForDate', () => {
    it('is true when the index quote was traded on the given Taipei date', () => {
      expect(hasMarketQuoteForDate([quote('^TWII', 42000)], '2026-11-06')).toBe(true)
    })

    it('is false on a holiday when the latest quote is from a previous day', () => {
      expect(hasMarketQuoteForDate([quote('^TWII', 42000, '2026-11-05')], '2026-11-06')).toBe(false)
    })

    it('is false when the index quote is missing', () => {
      expect(hasMarketQuoteForDate([quote('0050.TW', 98)], '2026-11-06')).toBe(false)
    })
  })
})
