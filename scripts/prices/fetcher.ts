import YahooFinance from 'yahoo-finance2'
import type { PriceRecord } from '@/types'

const yf = new YahooFinance({ suppressNotices: ['ripHistorical'] })

export async function fetchPriceData(
  ticker: string,
  fromDate: Date,
  toDate: Date
): Promise<PriceRecord[]> {
  const result = await yf.chart(ticker, {
    period1: fromDate,
    period2: toDate,
    interval: '1d',
  })

  return (result.quotes ?? [])
    .filter(q => q.close != null)
    .map((q): PriceRecord => ({
      date: new Date(q.date).toISOString().slice(0, 10),
      open: q.open ?? 0,
      high: q.high ?? 0,
      low: q.low ?? 0,
      close: q.close!,
      volume: q.volume ?? 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
}
