import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import type { PriceRecord, PriceTrend } from '@/types'

const DEFAULT_DIR = join(process.cwd(), 'data', 'prices')

function readAll(ticker: string, dir: string): PriceRecord[] {
  const filePath = join(dir, `${ticker}.json`)
  if (!existsSync(filePath)) return []
  try {
    const raw = JSON.parse(readFileSync(filePath, 'utf-8')) as PriceRecord[]
    return raw.sort((a, b) => a.date.localeCompare(b.date))
  } catch {
    return []
  }
}

export function getPriceHistory(ticker: string, days: number, dir = DEFAULT_DIR): PriceRecord[] {
  const all = readAll(ticker, dir)
  return all.slice(-days)
}

export function getPriceTrend(ticker: string, dir = DEFAULT_DIR): PriceTrend | null {
  const all = readAll(ticker, dir)
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
    change30d: Math.round(change30d * 100) / 100,
    change90d: Math.round(change90d * 100) / 100,
    high52w,
    low52w,
  }
}
