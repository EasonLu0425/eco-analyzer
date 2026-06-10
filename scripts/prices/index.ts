import type Database from 'better-sqlite3'
import type { PriceRecord } from '@/types'
import { getDb } from '@/lib/db'
import { fetchPriceData } from './fetcher'

export const TICKERS = ['0050.TW', '00692.TW', '00878.TW', '^TWII'] as const

const BOOTSTRAP_DAYS = 365

function nextDay(dateStr: string): Date {
  const d = new Date(dateStr)
  d.setUTCDate(d.getUTCDate() + 1)
  return d
}

export async function updatePrices(db?: Database.Database): Promise<void> {
  const d = db ?? getDb()

  for (const ticker of TICKERS) {
    const lastRow = d.prepare(
      'SELECT date FROM prices WHERE ticker = ? ORDER BY date DESC LIMIT 1',
    ).get(ticker) as { date: string } | undefined

    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    let fromDate: Date
    if (!lastRow) {
      fromDate = new Date(today)
      fromDate.setUTCDate(fromDate.getUTCDate() - BOOTSTRAP_DAYS)
    } else {
      fromDate = nextDay(lastRow.date)
    }

    if (fromDate > today) {
      console.log(`[prices] ${ticker} already up to date`)
      continue
    }

    try {
      const newRecords = await fetchPriceData(ticker, fromDate, today)
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
}
