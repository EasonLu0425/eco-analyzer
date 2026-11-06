import type Database from 'better-sqlite3'
import type { PriceRecord } from '@/types'
import { getDb } from '@/lib/db'
import { setMeta } from '@/lib/meta-store'
import { fetchPriceData } from './fetcher'

export const TICKERS = ['0050.TW', '00692.TW', '00878.TW', '^TWII', '^GSPC'] as const

/** Years of daily history kept for backtesting signals (fresh installs bootstrap this much). */
export const HISTORY_YEARS = 10

const BOOTSTRAP_DAYS = HISTORY_YEARS * 365

/** An earliest row within this many days of the target start counts as "deep enough". */
const BACKFILL_TOLERANCE_DAYS = 7

/**
 * Extend each ticker's history backwards to `years` ago. Existing rows are never touched
 * (INSERT OR IGNORE), so it is safe to re-run. Returns rows inserted per ticker.
 */
export async function backfillPrices(
  years: number = HISTORY_YEARS,
  db?: Database.Database,
): Promise<Record<string, number>> {
  const d = db ?? getDb()
  const now = new Date()
  const target = new Date(now)
  target.setUTCHours(0, 0, 0, 0)
  target.setUTCFullYear(target.getUTCFullYear() - years)

  const tolerance = new Date(target)
  tolerance.setUTCDate(tolerance.getUTCDate() + BACKFILL_TOLERANCE_DAYS)

  const insert = d.prepare(
    'INSERT OR IGNORE INTO prices (ticker, date, open, high, low, close, volume) VALUES (?, ?, ?, ?, ?, ?, ?)',
  )
  const inserted: Record<string, number> = {}

  for (const ticker of TICKERS) {
    inserted[ticker] = 0
    const first = d.prepare('SELECT MIN(date) AS date FROM prices WHERE ticker = ?').get(ticker) as { date: string | null }
    const earliest = first.date ? new Date(first.date) : null

    if (earliest && earliest <= tolerance) {
      console.log(`[backfill] ${ticker} already reaches ${first.date}`)
      continue
    }

    try {
      const records = await fetchPriceData(ticker, target, earliest ?? now)
      const count = d.transaction((rows: PriceRecord[]) => {
        let n = 0
        for (const r of rows) n += insert.run(ticker, r.date, r.open, r.high, r.low, r.close, r.volume).changes
        return n
      })(records)
      inserted[ticker] = count
      console.log(`[backfill] ${ticker} +${count} records (fetched ${records.length})`)
    } catch (err) {
      console.error(`[backfill] ${ticker} fetch failed:`, (err as Error).message)
    }
  }

  return inserted
}

export async function updatePrices(db?: Database.Database): Promise<void> {
  const d = db ?? getDb()

  for (const ticker of TICKERS) {
    const lastRow = d.prepare(
      'SELECT date FROM prices WHERE ticker = ? ORDER BY date DESC LIMIT 1',
    ).get(ticker) as { date: string } | undefined

    const now = new Date()
    const today = new Date(now)
    today.setUTCHours(0, 0, 0, 0)

    let fromDate: Date
    if (!lastRow) {
      fromDate = new Date(today)
      fromDate.setUTCDate(fromDate.getUTCDate() - BOOTSTRAP_DAYS)
    } else {
      // Re-fetch the last stored day too (INSERT OR REPLACE below): an earlier run during
      // the trading session may have stored a still-moving bar, and this corrects it to the final close.
      fromDate = new Date(lastRow.date)
    }

    if (fromDate > today) {
      console.log(`[prices] ${ticker} already up to date`)
      continue
    }

    try {
      const newRecords = await fetchPriceData(ticker, fromDate, now)
      if (newRecords.length === 0) {
        console.log(`[prices] ${ticker} no new data`)
        continue
      }

      const insert = d.prepare(
        'INSERT OR REPLACE INTO prices (ticker, date, open, high, low, close, volume) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      d.transaction((records: PriceRecord[]) => {
        for (const r of records) insert.run(ticker, r.date, r.open, r.high, r.low, r.close, r.volume)
      })(newRecords)

      console.log(`[prices] ${ticker} +${newRecords.length} records`)
    } catch (err) {
      console.error(`[prices] ${ticker} fetch failed:`, (err as Error).message)
    }
  }

  setMeta('prices_fetched_at', new Date().toISOString(), d)
}
