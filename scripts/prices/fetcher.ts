import YahooFinance from 'yahoo-finance2'
import type { IntradayQuote, PriceRecord } from '@/types'

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
    .filter(q => q.close != null && q.open != null && q.high != null && q.low != null)
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

/** Latest (possibly mid-session) quote. Returns null when Yahoo has no market price. */
export async function fetchQuote(ticker: string): Promise<IntradayQuote | null> {
  const q = await yf.quote(ticker)
  if (!q || q.regularMarketPrice == null) return null

  const price = q.regularMarketPrice
  return {
    ticker,
    price,
    open: q.regularMarketOpen ?? price,
    high: q.regularMarketDayHigh ?? price,
    low: q.regularMarketDayLow ?? price,
    volume: q.regularMarketVolume ?? 0,
    prevClose: q.regularMarketPreviousClose ?? price,
    marketTime: q.regularMarketTime ? new Date(q.regularMarketTime).toISOString() : '',
  }
}
