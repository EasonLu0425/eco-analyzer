import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { PriceRecord } from '@/types'
import { fetchPriceData } from './fetcher'

export const TICKERS = ['00662.TW', 'QQQ', '^TWII'] as const

const DEFAULT_DIR = join(process.cwd(), 'data', 'prices')
const BOOTSTRAP_DAYS = 365

function readExisting(filePath: string): PriceRecord[] {
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8')) as PriceRecord[]
  } catch {
    return []
  }
}

function nextDay(dateStr: string): Date {
  const d = new Date(dateStr)
  d.setUTCDate(d.getUTCDate() + 1)
  return d
}

export async function updatePrices(dir = DEFAULT_DIR): Promise<void> {
  mkdirSync(dir, { recursive: true })

  for (const ticker of TICKERS) {
    const filePath = join(dir, `${ticker}.json`)
    const existing = readExisting(filePath)

    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    let fromDate: Date
    if (existing.length === 0) {
      fromDate = new Date(today)
      fromDate.setUTCDate(fromDate.getUTCDate() - BOOTSTRAP_DAYS)
    } else {
      const lastDate = existing[existing.length - 1].date
      fromDate = nextDay(lastDate)
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

      const existingDates = new Set(existing.map(r => r.date))
      const toAppend = newRecords.filter(r => !existingDates.has(r.date))

      const merged = [...existing, ...toAppend].sort((a, b) => a.date.localeCompare(b.date))
      writeFileSync(filePath, JSON.stringify(merged, null, 2), 'utf-8')
      console.log(`[prices] ${ticker} +${toAppend.length} records → total ${merged.length}`)
    } catch (err) {
      console.error(`[prices] ${ticker} fetch failed:`, (err as Error).message)
    }
  }
}
