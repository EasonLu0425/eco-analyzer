import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import type { PriceRecord } from '@/types'
import { runMigrations } from '@/lib/db'

vi.mock('../fetcher', () => ({
  fetchPriceData: vi.fn(),
}))

import { fetchPriceData } from '../fetcher'
import { backfillPrices, updatePrices, HISTORY_YEARS, TICKERS } from '../index'
import { getMeta } from '@/lib/meta-store'

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

  it('bootstrap: fetches the full history window (~10 years) when no rows exist for ticker', async () => {
    mockFetch.mockResolvedValue([makeRecord('2026-06-09')])

    await updatePrices(db)

    expect(mockFetch).toHaveBeenCalledTimes(TICKERS.length)
    const [, fromDate] = mockFetch.mock.calls[0] as [string, Date, Date]
    const daysDiff = Math.round((Date.now() - fromDate.getTime()) / 86400000)
    expect(daysDiff).toBeGreaterThanOrEqual(HISTORY_YEARS * 365 - 5)
    expect(daysDiff).toBeLessThanOrEqual(HISTORY_YEARS * 365 + 5)
  })

  const seedRow = (ticker: string, date: string, close: number) =>
    db.prepare('INSERT INTO prices (ticker, date, open, high, low, close, volume) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      ticker, date, close - 1, close + 1, close - 2, close, 500000,
    )

  it('incremental: re-fetches from the last stored date (inclusive) so a partial bar gets corrected', async () => {
    seedRow('0050.TW', '2026-06-07', 100)
    seedRow('0050.TW', '2026-06-08', 101)

    mockFetch.mockResolvedValue([makeRecord('2026-06-08', 103), makeRecord('2026-06-09', 104)])

    await updatePrices(db)

    const call = mockFetch.mock.calls.find(c => c[0] === '0050.TW') as [string, Date, Date]
    expect(call[1].toISOString().slice(0, 10)).toBe('2026-06-08')
  })

  it('overwrites an in-progress bar with the final close from a later run', async () => {
    seedRow('0050.TW', '2026-06-08', 101)

    mockFetch.mockResolvedValue([makeRecord('2026-06-08', 103)])

    await updatePrices(db)

    const rows = getRows(db, '0050.TW')
    expect(rows).toHaveLength(1)
    expect(rows[0].close).toBe(103)
  })

  it('inserts new records into the database', async () => {
    seedRow('0050.TW', '2026-06-07', 100)
    seedRow('0050.TW', '2026-06-08', 101)

    mockFetch.mockResolvedValue([makeRecord('2026-06-09', 102)])

    await updatePrices(db)

    const rows = getRows(db, '0050.TW')
    expect(rows).toHaveLength(3)
    expect(rows[2].date).toBe('2026-06-09')
    expect(rows[2].close).toBe(102)
  })

  it('skips insert when fetchPriceData returns empty', async () => {
    seedRow('0050.TW', '2026-06-09', 100)

    mockFetch.mockResolvedValue([])

    await updatePrices(db)

    expect(getRows(db, '0050.TW')).toHaveLength(1)
  })

  it('continues with other tickers when one fails', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('rate limited'))
      .mockResolvedValue([makeRecord('2026-06-09')])

    await expect(updatePrices(db)).resolves.not.toThrow()
    expect(mockFetch).toHaveBeenCalledTimes(TICKERS.length)
  })

  it('records prices_fetched_at metadata after a run', async () => {
    mockFetch.mockResolvedValue([makeRecord('2026-06-09')])

    expect(getMeta('prices_fetched_at', db)).toBeNull()

    await updatePrices(db)

    const fetchedAt = getMeta('prices_fetched_at', db)
    expect(fetchedAt).not.toBeNull()
    expect(Number.isNaN(new Date(fetchedAt as string).getTime())).toBe(false)
  })
})

describe('backfillPrices', () => {
  let db: Database.Database

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-06T06:00:00.000Z'))
    db = makeDb()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const seedRow = (ticker: string, date: string, close: number) =>
    db.prepare('INSERT INTO prices (ticker, date, open, high, low, close, volume) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      ticker, date, close - 1, close + 1, close - 2, close, 500000,
    )

  it('fetches the missing older range up to the earliest stored date', async () => {
    seedRow('0050.TW', '2025-06-10', 90)
    mockFetch.mockResolvedValue([])

    await backfillPrices(10, db)

    const call = mockFetch.mock.calls.find(c => c[0] === '0050.TW') as [string, Date, Date]
    expect(call[1].toISOString().slice(0, 10)).toBe('2016-11-06')
    expect(call[2].toISOString().slice(0, 10)).toBe('2025-06-10')
  })

  it('fetches the whole window when a ticker has no rows yet', async () => {
    mockFetch.mockResolvedValue([])

    await backfillPrices(10, db)

    const call = mockFetch.mock.calls.find(c => c[0] === '^TWII') as [string, Date, Date]
    expect(call[1].toISOString().slice(0, 10)).toBe('2016-11-06')
    expect(call[2].toISOString().slice(0, 10)).toBe('2026-11-06')
  })

  it('skips a ticker whose history already reaches the target', async () => {
    seedRow('0050.TW', '2016-11-08', 50)
    mockFetch.mockResolvedValue([])

    await backfillPrices(10, db)

    expect(mockFetch.mock.calls.some(c => c[0] === '0050.TW')).toBe(false)
  })

  it('never overwrites rows that already exist', async () => {
    seedRow('0050.TW', '2025-06-10', 90)
    mockFetch.mockImplementation(async ticker =>
      ticker === '0050.TW' ? [makeRecord('2025-06-10', 999), makeRecord('2025-06-09', 88)] : [],
    )

    await backfillPrices(10, db)

    const rows = getRows(db, '0050.TW')
    expect(rows.map(r => [r.date, r.close])).toEqual([['2025-06-09', 88], ['2025-06-10', 90]])
  })

  it('returns the number of rows inserted per ticker', async () => {
    seedRow('0050.TW', '2025-06-10', 90)
    mockFetch.mockImplementation(async ticker =>
      ticker === '0050.TW' ? [makeRecord('2025-06-09'), makeRecord('2025-06-06'), makeRecord('2025-06-10')] : [],
    )

    const result = await backfillPrices(10, db)

    expect(result['0050.TW']).toBe(2)
    expect(result['^TWII']).toBe(0)
  })

  it('continues with other tickers when one fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('rate limited')).mockResolvedValue([])

    await expect(backfillPrices(10, db)).resolves.toBeDefined()
    expect(mockFetch).toHaveBeenCalledTimes(TICKERS.length)
  })
})
