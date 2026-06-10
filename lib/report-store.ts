
import type Database from 'better-sqlite3'
import type { AnalysisReport, WeeklyReport, MonthlyReport } from '@/types'
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
