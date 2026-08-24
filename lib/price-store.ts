import type Database from 'better-sqlite3'
import type { PriceRecord, PriceTrend } from '@/types'
import { getDb } from './db'

export function getPriceHistory(
  ticker: string,
  days: number,
  db?: Database.Database,
  asOfDate?: string,
): PriceRecord[] {
  const d = db ?? getDb()
  const rows = asOfDate
    ? d.prepare(
        'SELECT date, open, high, low, close, volume FROM prices WHERE ticker = ? AND date <= ? ORDER BY date ASC',
      ).all(ticker, asOfDate) as PriceRecord[]
    : d.prepare(
        'SELECT date, open, high, low, close, volume FROM prices WHERE ticker = ? ORDER BY date ASC',
      ).all(ticker) as PriceRecord[]
  return rows.slice(-days)
}

export function getPriceTrend(
  ticker: string,
  db?: Database.Database,
  asOfDate?: string,
): PriceTrend | null {
  const d = db ?? getDb()
  const all = asOfDate
    ? d.prepare(
        'SELECT date, open, high, low, close, volume FROM prices WHERE ticker = ? AND date <= ? ORDER BY date ASC',
      ).all(ticker, asOfDate) as PriceRecord[]
    : d.prepare(
        'SELECT date, open, high, low, close, volume FROM prices WHERE ticker = ? ORDER BY date ASC',
      ).all(ticker) as PriceRecord[]

  if (all.length < 31) return null

  const current = all[all.length - 1]
  const price30dAgo = all[Math.max(0, all.length - 31)]
  const price90dAgo = all[Math.max(0, all.length - 91)]

  const last365 = all.slice(-365)
  const high52w = Math.max(...last365.map(r => r.high))
  const low52w = Math.min(...last365.map(r => r.low))

  const change30d = ((current.close - price30dAgo.close) / price30dAgo.close) * 100
  const change90d = ((current.close - price90dAgo.close) / price90dAgo.close) * 100

  return {
    ticker,
    currentClose: current.close,
    change30d:    Math.round(change30d * 100) / 100,
    change90d:    Math.round(change90d * 100) / 100,
    high52w,
    low52w,
  }
}
