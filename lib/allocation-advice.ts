/**
 * Glue between stored data and the pure sizing rules: reads the user's portfolio, the latest
 * daily signal, and 0050's price history (market trend and volatility proxy), then asks
 * `suggestAllocation` what to do today.
 */
import type Database from 'better-sqlite3'
import type { ETFSignal } from '@/types'
import { getDb } from './db'
import { getPortfolio } from './portfolio-store'
import { getPriceHistory } from './price-store'
import { getLatestReport } from './report-store'
import { sma } from './signal-study'
import { suggestAllocation, type AllocationAdvice } from './position-sizing'
import { volForecast } from './vol-forecast'

export const MARKET_TICKER = '0050.TW'
const ALL_HISTORY = 100000
const MA_LONG = 200
const MA_MID = 60
const MA_MID_LOOKBACK = 20
const NEUTRAL_SIGNAL: ETFSignal = 'hold'

export interface Trend {
  aboveMa200: boolean | null
  ma60Rising: boolean | null
}

/** Above the 200-day average and whether the 60-day average is higher than 20 bars ago. */
export function trendFromCloses(closes: readonly number[]): Trend {
  if (closes.length < MA_LONG) return { aboveMa200: null, ma60Rising: null }
  const values = [...closes]
  const last = values.length - 1
  const ma200 = sma(values, MA_LONG)[last]
  const ma60 = sma(values, MA_MID)
  const now = ma60[last]
  const before = ma60[last - MA_MID_LOOKBACK]
  return {
    aboveMa200: ma200 == null ? null : values[last] > ma200,
    ma60Rising: now == null || before == null ? null : now > before,
  }
}

export interface AllocationResult {
  advice: AllocationAdvice
  signal: ETFSignal
  signalDate: string | null    // null = no report yet, neutral pace assumed
  priceDates: Record<string, string>
  asOf: string | null          // date of the market (0050) data behind trend and volatility
}

/**
 * Null when the user has not entered any holding or watched ticker yet.
 * `db` holds prices and reports; `portfolioDb` holds the personal portfolio (a separate file).
 */
export function getAllocationAdvice(db?: Database.Database, portfolioDb?: Database.Database): AllocationResult | null {
  const d = db ?? getDb()
  const portfolio = getPortfolio(portfolioDb)
  if (portfolio.holdings.length === 0) return null

  const market = getPriceHistory(MARKET_TICKER, ALL_HISTORY, d)
  const closes = market.map(r => r.close)
  const vol = volForecast(market.map(r => r.date), closes)
  const report = getLatestReport(d)
  const signal = report?.signal ?? NEUTRAL_SIGNAL

  const priceDates: Record<string, string> = {}
  const positions = portfolio.holdings.map(h => {
    const latest = getPriceHistory(h.ticker, 1, d)[0]
    if (latest?.close != null) priceDates[h.ticker] = latest.date
    return { ...h, price: latest?.close ?? null }
  })

  const advice = suggestAllocation({
    market: { signal, ...trendFromCloses(closes), volPercentile: vol?.volPercentile ?? null },
    cash: portfolio.cash,
    positions,
  })
  if (!report) advice.notes.push('尚無分析報告，訊號以持平計算（買進速度減半）')

  return { advice, signal, signalDate: report?.date ?? null, priceDates, asOf: market.at(-1)?.date ?? null }
}
