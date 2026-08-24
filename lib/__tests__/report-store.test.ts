import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { randomUUID } from 'crypto'
import { runMigrations } from '@/lib/db'
import { getMissingReportDates, saveReport } from '@/lib/report-store'
import type { AnalysisReport } from '@/types'

function makeDb() {
  const db = new Database(':memory:')
  runMigrations(db)
  return db
}

function seedPriceDates(db: Database.Database, ticker: string, dates: string[]) {
  const insert = db.prepare(
    'INSERT INTO prices (ticker, date, open, high, low, close, volume) VALUES (?, ?, 100, 101, 99, 100, 1000)',
  )
  db.transaction(() => {
    for (const date of dates) insert.run(ticker, date)
  })()
}

function seedReport(db: Database.Database, date: string) {
  const report: AnalysisReport = {
    id: randomUUID(),
    date,
    sentimentScore: 5,
    signal: 'hold',
    summary: 'test',
    risks: [],
    topHeadlines: [],
    newsCount: 0,
    createdAt: new Date().toISOString(),
  }
  saveReport(report, db)
}

describe('getMissingReportDates', () => {
  let db: Database.Database

  beforeEach(() => { db = makeDb() })

  it('returns empty array when every trading date already has a report', () => {
    const dates = ['2026-07-20', '2026-07-21', '2026-07-22']
    seedPriceDates(db, '0050.TW', dates)
    for (const date of dates) seedReport(db, date)

    const missing = getMissingReportDates(14, db, '2026-07-22')

    expect(missing).toEqual([])
  })

  it('returns missing trading dates ascending, skipping non-trading days automatically', () => {
    // 07-20/21 are trading days with no report; 07-22 has a report already.
    const dates = ['2026-07-20', '2026-07-21', '2026-07-22']
    seedPriceDates(db, '0050.TW', dates)
    seedReport(db, '2026-07-22')

    const missing = getMissingReportDates(14, db, '2026-07-22')

    expect(missing).toEqual(['2026-07-20', '2026-07-21'])
  })

  it('caps lookback to maxDays, excluding older missing dates', () => {
    const dates = ['2026-07-01', '2026-07-10', '2026-07-20', '2026-07-21']
    seedPriceDates(db, '0050.TW', dates)
    // Nothing has a report — but only the last 3 days back from "today" should surface.
    const missing = getMissingReportDates(3, db, '2026-07-21')

    expect(missing).toEqual(['2026-07-20', '2026-07-21'])
  })

  it('always includes today even with no price data yet, so the cron gate cannot deadlock before Step 0 fetches prices', () => {
    const missing = getMissingReportDates(14, db, '2026-07-22')
    expect(missing).toEqual(['2026-07-22'])
  })

  it('does not include today when a report for it already exists, even with no price data', () => {
    seedReport(db, '2026-07-22')
    const missing = getMissingReportDates(14, db, '2026-07-22')
    expect(missing).toEqual([])
  })

  it('treats trading dates from any ticker as a valid trading day', () => {
    seedPriceDates(db, '00692.TW', ['2026-07-21'])
    seedPriceDates(db, '^TWII', ['2026-07-22'])

    const missing = getMissingReportDates(14, db, '2026-07-22')

    expect(missing).toEqual(['2026-07-21', '2026-07-22'])
  })
})
