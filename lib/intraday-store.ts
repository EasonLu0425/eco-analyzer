import type Database from 'better-sqlite3'
import type { IntradayQuote, ReportSession } from '@/types'
import { getDb } from './db'

export const TAIWAN_INDEX_TICKER = '^TWII'

export interface StoredIntradayQuote extends IntradayQuote {
  date: string
  session: ReportSession
  capturedAt: string
}

export function saveIntradayQuotes(
  date: string,
  session: ReportSession,
  quotes: IntradayQuote[],
  capturedAt: string,
  db?: Database.Database,
): void {
  const d = db ?? getDb()
  const insert = d.prepare(`
    INSERT OR REPLACE INTO intraday_prices
      (ticker, date, session, captured_at, price, open, high, low, volume, prev_close, market_time)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  d.transaction((rows: IntradayQuote[]) => {
    for (const q of rows) {
      insert.run(
        q.ticker, date, session, capturedAt,
        q.price, q.open, q.high, q.low, q.volume, q.prevClose, q.marketTime,
      )
    }
  })(quotes)
}

export function getIntradayQuotes(
  date: string,
  session?: ReportSession,
  db?: Database.Database,
): StoredIntradayQuote[] {
  const d = db ?? getDb()
  const rows = (session
    ? d.prepare('SELECT * FROM intraday_prices WHERE date = ? AND session = ? ORDER BY ticker').all(date, session)
    : d.prepare('SELECT * FROM intraday_prices WHERE date = ? ORDER BY session, ticker').all(date)
  ) as Record<string, unknown>[]

  return rows.map(r => ({
    ticker: r.ticker as string,
    date: r.date as string,
    session: r.session as ReportSession,
    capturedAt: r.captured_at as string,
    price: r.price as number,
    open: r.open as number,
    high: r.high as number,
    low: r.low as number,
    volume: r.volume as number,
    prevClose: r.prev_close as number,
    marketTime: r.market_time as string,
  }))
}

function toTaipeiDate(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(new Date(iso))
}

/**
 * True when the Taiwan index quote was last traded on `date` (Asia/Taipei).
 * On a market holiday the latest quote is from a previous trading day, so this is false.
 */
export function hasMarketQuoteForDate(quotes: IntradayQuote[], date: string): boolean {
  const index = quotes.find(q => q.ticker === TAIWAN_INDEX_TICKER)
  if (!index || !index.marketTime) return false
  return toTaipeiDate(index.marketTime) === date
}
