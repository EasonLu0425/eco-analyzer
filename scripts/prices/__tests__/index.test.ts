import { describe, it, expect, vi, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import type { PriceRecord } from '@/types'
import { runMigrations } from '@/lib/db'

vi.mock('../fetcher', () => ({
  fetchPriceData: vi.fn(),
}))

import { fetchPriceData } from '../fetcher'
import { updatePrices, TICKERS } from '../index'

const mockFetch = vi.mocked(fetchPriceData)

const makeRecord = (date: string, close = 100): PriceRecord => ({
  date,
  open: close - 1,
  high: close + 1,
  low: close - 2,
  close,
  volume: 500000,
})

function makeDb() {
  const db = new Database(':memory:')
  runMigrations(db)
  return db
}

function getRows(db: Database.Database, ticker: string): PriceRecord[] {
  return db.prepare(
    'SELECT date, open, high, low, close, volume FROM prices WHERE ticker = ? ORDER BY date ASC',
  ).all(ticker) as PriceRecord[]
}

describe('updatePrices', () => {
  let db: Database.Database

  beforeEach(() => {
    vi.clearAllMocks()
    db = makeDb()
  })

  it('bootstrap: fetches ~365 days when no rows exist for ticker', async () => {
    mockFetch.mockResolvedValue([makeRecord('2026-06-09')])

    await updatePrices(db)

    expect(mockFetch).toHaveBeenCalledTimes(TICKERS.length)
    const [, fromDate] = mockFetch.mock.calls[0] as [string, Date, Date]
    const daysDiff = Math.round((Date.now() - fromDate.getTime()) / 86400000)
    expect(daysDiff).toBeGreaterThanOrEqual(360)
    expect(daysDiff).toBeLessThanOrEqual(370)
  })

  it('incremental: fetches only from lastDate+1 when rows already exist', async () => {
    db.prepare('INSERT INTO prices (ticker, date, open, high, low, close, volume) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      '00662.TW', '2026-06-07', 99, 101, 98, 100, 500000,
    )
    db.prepare('INSERT INTO prices (ticker, date, open, high, low, close, volume) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      '00662.TW', '2026-06-08', 100, 102, 99, 101, 500000,
    )

    mockFetch.mockResolvedValue([makeRecord('2026-06-09')])

    await updatePrices(db)

    const [, fromDate] = mockFetch.mock.calls[0] as [string, Date, Date]
    expect(fromDate.toISOString().slice(0, 10)).toBe('2026-06-09')
  })

  it('inserts new records into the database', async () => {
    db.prepare('INSERT INTO prices (ticker, date, open, high, low, close, volume) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      '00662.TW', '2026-06-07', 99, 101, 98, 100, 500000,
    )
    db.prepare('INSERT INTO prices (ticker, date, open, high, low, close, volume) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      '00662.TW', '2026-06-08', 100, 102, 99, 101, 500000,
    )

    mockFetch.mockResolvedValue([makeRecord('2026-06-09', 102)])

    await updatePrices(db)

    const rows = getRows(db, '00662.TW')
    expect(rows).toHaveLength(3)
    expect(rows[2].date).toBe('2026-06-09')
    expect(rows[2].close).toBe(102)
  })

  it('skips insert when fetchPriceData returns empty', async () => {
    db.prepare('INSERT INTO prices (ticker, date, open, high, low, close, volume) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      '00662.TW', '2026-06-09', 99, 101, 98, 100, 500000,
    )

    mockFetch.mockResolvedValue([])

    await updatePrices(db)

    const rows = getRows(db, '00662.TW')
    expect(rows).toHaveLength(1)
  })

  it('continues with other tickers when one fails', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('rate limited'))
      .mockResolvedValue([makeRecord('2026-06-09')])

    await expect(updatePrices(db)).resolves.not.toThrow()
    expect(mockFetch).toHaveBeenCalledTimes(TICKERS.length)
  })
})
