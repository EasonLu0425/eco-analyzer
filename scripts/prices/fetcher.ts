import YahooFinance from 'yahoo-finance2'
import type { PriceRecord } from '@/types'

const yf = new YahooFinance()

export async function fetchPriceData(
  ticker: string,
  fromDate: Date,
  toDate: Date
): Promise<PriceRecord[]> {
  const rows = await yf.historical(ticker, {
    period1: fromDate,
    period2: toDate,
    interval: '1d' as const,
    events: 'history' as const,
  })

  return rows
    .map((r): PriceRecord => ({
      date: r.date.toISOString().slice(0, 10),
      open: r.open ?? 0,
      high: r.high ?? 0,
      low: r.low ?? 0,
      close: r.close ?? 0,
      volume: r.volume ?? 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
}
