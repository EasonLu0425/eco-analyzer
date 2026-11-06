
import type Database from 'better-sqlite3'
import type { AnalysisReport, WeeklyReport, MonthlyReport, ReportSession } from '@/types'
import { getDb, rowToReport } from './db'

export function saveReport(report: AnalysisReport, db?: Database.Database): void {
  const d = db ?? getDb()
  d.prepare(`
    INSERT OR REPLACE INTO reports
      (id, date, sentiment_score, signal, summary, risks, top_headlines, news_count, created_at, price_trends)
    VALUES
      (@id, @date, @sentiment_score, @signal, @summary, @risks, @top_headlines, @news_count, @created_at, @price_trends)
  `).run({
    id:              report.id,
    date:            report.date,
    sentiment_score: report.sentimentScore,
    signal:          report.signal,
    summary:         report.summary,
    risks:           JSON.stringify(report.risks),
    top_headlines:   JSON.stringify(report.topHeadlines),
    news_count:      report.newsCount,
    created_at:      report.createdAt,
    price_trends:    report.priceTrends ? JSON.stringify(report.priceTrends) : null,
  })
}

/**
 * Save a per-session analysis. The snapshot table keeps every session's report for the day,
 * while `reports` (one row per date, read by the web UI/API) always holds the most recent one.
 */
export function saveReportSnapshot(
  report: AnalysisReport,
  session: ReportSession,
  db?: Database.Database,
): void {
  const d = db ?? getDb()
  d.transaction(() => {
    d.prepare(`
      INSERT OR REPLACE INTO report_snapshots (date, session, data, created_at)
      VALUES (?, ?, ?, ?)
    `).run(report.date, session, JSON.stringify(report), report.createdAt)
    saveReport(report, d)
  })()
}

export function hasReportSnapshot(
  date: string,
  session: ReportSession,
  db?: Database.Database,
): boolean {
  const d = db ?? getDb()
  return d.prepare('SELECT 1 FROM report_snapshots WHERE date = ? AND session = ?').get(date, session) !== undefined
}

export function getReportSnapshots(
  date: string,
  db?: Database.Database,
): Array<{ session: ReportSession; report: AnalysisReport }> {
  const d = db ?? getDb()
  const rows = d.prepare(`
    SELECT session, data FROM report_snapshots WHERE date = ?
    ORDER BY CASE session WHEN 'morning' THEN 0 WHEN 'midday' THEN 1 ELSE 2 END
  `).all(date) as Array<{ session: ReportSession; data: string }>
  return rows.map(r => ({ session: r.session, report: JSON.parse(r.data) as AnalysisReport }))
}

export function getLatestReport(db?: Database.Database): AnalysisReport | null {
  const d = db ?? getDb()
  const row = d.prepare('SELECT * FROM reports ORDER BY date DESC LIMIT 1').get()
  return row ? rowToReport(row as Record<string, unknown>) : null
}

export function getReportByDate(date: string, db?: Database.Database): AnalysisReport | null {
  const d = db ?? getDb()
  const row = d.prepare('SELECT * FROM reports WHERE date = ?').get(date)
  return row ? rowToReport(row as Record<string, unknown>) : null
}

export function taipeiToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(new Date())
}

export function getMissingReportDates(
  maxDays: number,
  db?: Database.Database,
  today?: string,
): string[] {
  const d = db ?? getDb()
  const todayStr = today ?? taipeiToday()
  const windowStart = new Date(todayStr)
  windowStart.setUTCDate(windowStart.getUTCDate() - (maxDays - 1))
  const windowStartStr = windowStart.toISOString().slice(0, 10)

  const tradingDates = d.prepare(
    'SELECT DISTINCT date FROM prices WHERE date >= ? AND date <= ? ORDER BY date ASC',
  ).all(windowStartStr, todayStr) as { date: string }[]

  // Today is always a candidate even if `prices` has no row for it yet — Step 0
  // (fetch-prices) only runs *inside* the gated command, so relying solely on
  // `prices` here would let the cron gate see "no gap" and never invoke it.
  const candidateDates = new Set(tradingDates.map(r => r.date))
  candidateDates.add(todayStr)

  const existingDates = new Set(
    (d.prepare(
      'SELECT date FROM reports WHERE date >= ? AND date <= ?',
    ).all(windowStartStr, todayStr) as { date: string }[]).map(r => r.date),
  )

  return Array.from(candidateDates)
    .filter(date => !existingDates.has(date))
    .sort()
}

export function getReports(
  page: number,
  limit: number,
  db?: Database.Database,
): { reports: AnalysisReport[]; total: number } {
  const d = db ?? getDb()
  const { count } = d.prepare('SELECT COUNT(*) as count FROM reports').get() as { count: number }
  const offset = (page - 1) * limit
  const rows = d.prepare('SELECT * FROM reports ORDER BY date DESC LIMIT ? OFFSET ?').all(limit, offset)
  return { reports: rows.map(r => rowToReport(r as Record<string, unknown>)), total: count }
}

export function saveWeeklyReport(report: WeeklyReport, db?: Database.Database): void {
  const d = db ?? getDb()
  d.prepare(`
    INSERT OR REPLACE INTO weekly_reports (id, week_start, data, created_at)
    VALUES (@id, @week_start, @data, @created_at)
  `).run({
    id:         report.id,
    week_start: report.weekStart,
    data:       JSON.stringify(report),
    created_at: report.createdAt,
  })
}

/** Monday (YYYY-MM-DD) of the calendar week before the week containing `today`. */
export function getLastWeekStart(today: string): string {
  const d = new Date(`${today}T00:00:00Z`)
  const daysSinceMonday = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - daysSinceMonday - 7)
  return d.toISOString().slice(0, 10)
}

/**
 * True when last week has daily reports but no weekly report yet.
 * Used as the cron gate: false means "nothing to do" (already generated, or no data).
 */
export function isWeeklyReportMissing(
  today?: string,
  db?: Database.Database,
): boolean {
  const d = db ?? getDb()
  const weekStart = getLastWeekStart(today ?? taipeiToday())
  const end = new Date(`${weekStart}T00:00:00Z`)
  end.setUTCDate(end.getUTCDate() + 6)
  const weekEnd = end.toISOString().slice(0, 10)

  const { count } = d.prepare(
    'SELECT COUNT(*) as count FROM reports WHERE date >= ? AND date <= ?',
  ).get(weekStart, weekEnd) as { count: number }
  if (count === 0) return false

  const existing = d.prepare('SELECT 1 FROM weekly_reports WHERE week_start = ?').get(weekStart)
  return !existing
}

/** YYYY-MM of the calendar month before the month containing `today`. */
export function getLastMonth(today: string): string {
  const year = Number(today.slice(0, 4))
  const month = Number(today.slice(5, 7))
  const prev = new Date(Date.UTC(year, month - 2, 1))
  return prev.toISOString().slice(0, 7)
}

/** True when last month has daily reports but no monthly report yet (cron gate). */
export function isMonthlyReportMissing(
  today?: string,
  db?: Database.Database,
): boolean {
  const d = db ?? getDb()
  const month = getLastMonth(today ?? taipeiToday())

  const { count } = d.prepare(
    "SELECT COUNT(*) as count FROM reports WHERE substr(date, 1, 7) = ?",
  ).get(month) as { count: number }
  if (count === 0) return false

  const existing = d.prepare('SELECT 1 FROM monthly_reports WHERE month = ?').get(month)
  return !existing
}

export function getWeeklyReports(db?: Database.Database): WeeklyReport[] {
  const d = db ?? getDb()
  const rows = d.prepare('SELECT data FROM weekly_reports ORDER BY week_start DESC').all()
  return rows.map(r => JSON.parse((r as { data: string }).data) as WeeklyReport)
}

export function saveMonthlyReport(report: MonthlyReport, db?: Database.Database): void {
  const d = db ?? getDb()
  d.prepare(`
    INSERT OR REPLACE INTO monthly_reports (id, month, data, created_at)
    VALUES (@id, @month, @data, @created_at)
  `).run({
    id:         report.id,
    month:      report.month,
    data:       JSON.stringify(report),
    created_at: report.createdAt,
  })
}

export function getMonthlyReports(db?: Database.Database): MonthlyReport[] {
  const d = db ?? getDb()
  const rows = d.prepare('SELECT data FROM monthly_reports ORDER BY month DESC').all()
  return rows.map(r => JSON.parse((r as { data: string }).data) as MonthlyReport)
}
