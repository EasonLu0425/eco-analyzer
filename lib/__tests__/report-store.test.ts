import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { randomUUID } from 'crypto'
import { runMigrations } from '@/lib/db'
import {
  getLastMonth,
  getReportByDate,
  getReportSnapshots,
  hasReportSnapshot,
  saveReportSnapshot,
  getLastWeekStart,
  getMissingReportDates,
  isMonthlyReportMissing,
  isWeeklyReportMissing,
  saveReport,
  saveWeeklyReport,
} from '@/lib/report-store'
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

describe('getLastWeekStart', () => {
  it('returns previous Monday when today is Monday', () => {
    expect(getLastWeekStart('2026-11-02')).toBe('2026-10-26')
  })

  it('returns previous Monday when today is mid-week', () => {
    expect(getLastWeekStart('2026-11-06')).toBe('2026-10-26')
  })

  it('returns previous Monday when today is Sunday', () => {
    expect(getLastWeekStart('2026-11-08')).toBe('2026-10-26')
  })
})

describe('isWeeklyReportMissing', () => {
  let db: Database.Database

  beforeEach(() => {
    db = makeDb()
  })

  it('is false when last week has no daily reports (nothing to summarize)', () => {
    expect(isWeeklyReportMissing('2026-11-06', db)).toBe(false)
  })

  it('is true when last week has daily reports but no weekly report', () => {
    seedReport(db, '2026-10-28')
    expect(isWeeklyReportMissing('2026-11-06', db)).toBe(true)
  })

  it('is false when the weekly report already exists', () => {
    seedReport(db, '2026-10-28')
    saveWeeklyReport(
      {
        id: randomUUID(),
        weekStart: '2026-10-26',
        weekEnd: '2026-11-01',
        avgSentimentScore: 5,
        dominantSignal: 'hold',
        tradingDays: 1,
        pricePerformance: [],
        keyThemes: [],
        topRisks: [],
        weeklyInsight: 'x',
        vsLastWeek: 'x',
        createdAt: new Date().toISOString(),
      },
      db,
    )
    expect(isWeeklyReportMissing('2026-11-06', db)).toBe(false)
  })
})

describe('getLastMonth', () => {
  it('returns previous month mid-year', () => {
    expect(getLastMonth('2026-11-06')).toBe('2026-10')
  })

  it('rolls back across the year boundary', () => {
    expect(getLastMonth('2027-01-01')).toBe('2026-12')
  })

  it('handles the 31st of a month after a shorter month', () => {
    expect(getLastMonth('2026-03-31')).toBe('2026-02')
  })
})

describe('isMonthlyReportMissing', () => {
  let db: Database.Database

  beforeEach(() => {
    db = makeDb()
  })

  it('is false when last month has no daily reports', () => {
    expect(isMonthlyReportMissing('2026-11-01', db)).toBe(false)
  })

  it('is true when last month has daily reports but no monthly report', () => {
    seedReport(db, '2026-10-28')
    expect(isMonthlyReportMissing('2026-11-01', db)).toBe(true)
  })

  it('is false when the monthly report already exists', () => {
    seedReport(db, '2026-10-28')
    db.prepare('INSERT INTO monthly_reports (id, month, data, created_at) VALUES (?, ?, ?, ?)')
      .run(randomUUID(), '2026-10', '{}', new Date().toISOString())
    expect(isMonthlyReportMissing('2026-11-01', db)).toBe(false)
  })
})

describe('report snapshots', () => {
  let db: Database.Database

  beforeEach(() => {
    db = makeDb()
  })

  const makeReport = (date: string, score: number): AnalysisReport => ({
    id: randomUUID(),
    date,
    sentimentScore: score,
    signal: 'hold',
    summary: `score ${score}`,
    risks: [],
    topHeadlines: [],
    newsCount: 0,
    createdAt: new Date().toISOString(),
  })

  it('stores a snapshot and also makes it the canonical report for the date', () => {
    saveReportSnapshot(makeReport('2026-11-06', 4), 'morning', db)
    expect(getReportByDate('2026-11-06', db)?.sentimentScore).toBe(4)
    expect(hasReportSnapshot('2026-11-06', 'morning', db)).toBe(true)
  })

  it('keeps every session in history while reports holds only the latest', () => {
    saveReportSnapshot(makeReport('2026-11-06', 4), 'morning', db)
    saveReportSnapshot(makeReport('2026-11-06', 3), 'midday', db)
    saveReportSnapshot(makeReport('2026-11-06', 2), 'close', db)

    expect(getReportByDate('2026-11-06', db)?.sentimentScore).toBe(2)
    const snaps = getReportSnapshots('2026-11-06', db)
    expect(snaps.map(s => [s.session, s.report.sentimentScore])).toEqual([
      ['morning', 4],
      ['midday', 3],
      ['close', 2],
    ])
    const { count } = db.prepare('SELECT COUNT(*) as count FROM reports').get() as { count: number }
    expect(count).toBe(1)
  })

  it('replaces the same session snapshot when re-run', () => {
    saveReportSnapshot(makeReport('2026-11-06', 4), 'midday', db)
    saveReportSnapshot(makeReport('2026-11-06', 5), 'midday', db)
    expect(getReportSnapshots('2026-11-06', db)).toHaveLength(1)
    expect(getReportSnapshots('2026-11-06', db)[0].report.sentimentScore).toBe(5)
  })

  it('reports false for a session that has no snapshot', () => {
    saveReportSnapshot(makeReport('2026-11-06', 4), 'morning', db)
    expect(hasReportSnapshot('2026-11-06', 'close', db)).toBe(false)
    expect(hasReportSnapshot('2026-11-05', 'morning', db)).toBe(false)
  })
})
