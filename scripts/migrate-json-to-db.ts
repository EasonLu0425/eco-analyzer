import 'dotenv/config'
import { existsSync, readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import type { AnalysisReport, PriceRecord, WeeklyReport, MonthlyReport } from '@/types'
import { getDb } from '@/lib/db'
import { saveReport, saveWeeklyReport, saveMonthlyReport } from '@/lib/report-store'

const DATA_DIR = join(process.cwd(), 'data')

function readJsonFiles<T>(dir: string): T[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .flatMap(f => {
      try {
        return [JSON.parse(readFileSync(join(dir, f), 'utf-8')) as T]
      } catch {
        console.warn(`[migrate] skip corrupt file: ${f}`)
        return []
      }
    })
}

async function main() {
  const db = getDb()
  const count = { reports: 0, prices: 0, weekly: 0, monthly: 0 }

  // Reports
  const reports = readJsonFiles<AnalysisReport>(join(DATA_DIR, 'reports'))
  for (const r of reports) {
    try {
      saveReport(r, db)
      count.reports++
    } catch (e) {
      console.warn(`[migrate] report ${r.date} failed:`, (e as Error).message)
    }
  }
  console.log(`[migrate] reports: ${count.reports}`)

  // Prices
  const TICKERS = ['0050.TW', '00692.TW', '00878.TW', '^TWII']
  const insert = db.prepare(
    'INSERT OR REPLACE INTO prices (ticker, date, open, high, low, close, volume) VALUES (?, ?, ?, ?, ?, ?, ?)',
  )
  for (const ticker of TICKERS) {
    const filePath = join(DATA_DIR, 'prices', `${ticker}.json`)
    if (!existsSync(filePath)) continue
    try {
      const records: PriceRecord[] = JSON.parse(readFileSync(filePath, 'utf-8'))
      db.transaction(() => {
        for (const r of records) {
          insert.run(ticker, r.date, r.open, r.high, r.low, r.close, r.volume)
          count.prices++
        }
      })()
      console.log(`[migrate] ${ticker}: ${records.length} price rows`)
    } catch (e) {
      console.warn(`[migrate] prices/${ticker} failed:`, (e as Error).message)
    }
  }

  // Weekly reports
  const weeklyReports = readJsonFiles<WeeklyReport>(join(DATA_DIR, 'weekly'))
  for (const r of weeklyReports) {
    try {
      saveWeeklyReport(r, db)
      count.weekly++
    } catch (e) {
      console.warn(`[migrate] weekly ${r.weekStart} failed:`, (e as Error).message)
    }
  }
  console.log(`[migrate] weekly: ${count.weekly}`)

  // Monthly reports
  const monthlyReports = readJsonFiles<MonthlyReport>(join(DATA_DIR, 'monthly'))
  for (const r of monthlyReports) {
    try {
      saveMonthlyReport(r, db)
      count.monthly++
    } catch (e) {
      console.warn(`[migrate] monthly ${r.month} failed:`, (e as Error).message)
    }
  }
  console.log(`[migrate] monthly: ${count.monthly}`)

  console.log(`[migrate] done — reports:${count.reports} prices:${count.prices} weekly:${count.weekly} monthly:${count.monthly}`)
}

main().catch(err => {
  console.error('[migrate] fatal:', err)
  process.exit(1)
})
