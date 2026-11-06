import { saveIntradayQuotes, hasMarketQuoteForDate } from '../lib/intraday-store'
import { taipeiToday } from '../lib/report-store'
import { parseSession } from '../lib/session'
import type { IntradayQuote } from '../types'
import { fetchQuote } from './prices/fetcher'
import { TICKERS } from './prices/index'

// Exit codes: 0 = quotes saved, 2 = Taiwan market had no trading today (holiday), 1 = error.
const EXIT_MARKET_CLOSED = 2

async function main() {
  const session = parseSession(process.argv.slice(2).find(a => a.startsWith('--session=')))
  const today = taipeiToday()

  const quotes: IntradayQuote[] = []
  for (const ticker of TICKERS) {
    try {
      const q = await fetchQuote(ticker)
      if (q) quotes.push(q)
      else console.log(`[intraday] ${ticker} no quote`)
    } catch (err) {
      console.error(`[intraday] ${ticker} fetch failed:`, (err as Error).message)
    }
  }

  if (quotes.length === 0) {
    console.error('[intraday] 沒有取得任何報價')
    process.exit(1)
  }

  saveIntradayQuotes(today, session, quotes, new Date().toISOString())
  for (const q of quotes) {
    const chg = q.prevClose ? ((q.price - q.prevClose) / q.prevClose) * 100 : 0
    console.log(`[intraday] ${q.ticker} ${q.price} (${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%)`)
  }

  if (!hasMarketQuoteForDate(quotes, today)) {
    console.log(`[intraday] ^TWII 最新成交非 ${today}，判定今日台股休市`)
    process.exit(EXIT_MARKET_CLOSED)
  }
}

main().catch(err => {
  console.error('[intraday] 失敗:', err)
  process.exit(1)
})
