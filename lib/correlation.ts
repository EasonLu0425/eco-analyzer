import type Database from 'better-sqlite3'
import type { CorrelationResult } from '@/types'
import { getDb } from '@/lib/db'

function pearson(xs: number[], ys: number[]): number {
  const n = xs.length
  if (n < 2) return NaN
  const meanX = xs.reduce((a, b) => a + b, 0) / n
  const meanY = ys.reduce((a, b) => a + b, 0) / n
  let cov = 0
  let sdX = 0
  let sdY = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX
    const dy = ys[i] - meanY
    cov += dx * dy
    sdX += dx * dx
    sdY += dy * dy
  }
  if (sdX === 0 || sdY === 0) return NaN
  return cov / Math.sqrt(sdX * sdY)
}

type PriceRow = { date: string; close: number }

export function computeCorrelation(
  ticker: string,
  benchmarkTicker: string,
  days = 30,
  db?: Database.Database,
  asOfDate?: string,
): CorrelationResult | null {
  const d = db ?? getDb()

  const rows1 = asOfDate
    ? d.prepare('SELECT date, close FROM prices WHERE ticker = ? AND date <= ? ORDER BY date DESC LIMIT ?')
        .all(ticker, asOfDate, days + 1) as PriceRow[]
    : d.prepare('SELECT date, close FROM prices WHERE ticker = ? ORDER BY date DESC LIMIT ?')
        .all(ticker, days + 1) as PriceRow[]

  const rows2 = asOfDate
    ? d.prepare('SELECT date, close FROM prices WHERE ticker = ? AND date <= ? ORDER BY date DESC LIMIT ?')
        .all(benchmarkTicker, asOfDate, days + 1) as PriceRow[]
    : d.prepare('SELECT date, close FROM prices WHERE ticker = ? ORDER BY date DESC LIMIT ?')
        .all(benchmarkTicker, days + 1) as PriceRow[]

  if (rows1.length < 2 || rows2.length < 2) return null

  const map1 = new Map(rows1.map(r => [r.date, r.close]))
  const map2 = new Map(rows2.map(r => [r.date, r.close]))

  const dates = [...map1.keys()].filter(d => map2.has(d)).sort()
  if (dates.length < 2) return null

  const logReturns1: number[] = []
  const logReturns2: number[] = []

  for (let i = 1; i < dates.length; i++) {
    logReturns1.push(Math.log(map1.get(dates[i])! / map1.get(dates[i - 1])!))
    logReturns2.push(Math.log(map2.get(dates[i])! / map2.get(dates[i - 1])!))
  }

  const corr = pearson(logReturns1, logReturns2)
  if (isNaN(corr)) return null

  return {
    ticker,
    correlation: Math.round(corr * 1000) / 1000,
    period: logReturns1.length,
    fromDate: dates[0],
    toDate: dates[dates.length - 1],
  }
}
