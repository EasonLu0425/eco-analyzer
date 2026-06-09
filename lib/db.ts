import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import type { AnalysisReport } from '@/types'

const DB_PATH = process.env.DATABASE_PATH ?? path.join(process.cwd(), 'data', 'eco-news.db')

let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (_db) return _db
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
  _db = new Database(DB_PATH)
  _db.exec(`
    CREATE TABLE IF NOT EXISTS reports (
      id              TEXT PRIMARY KEY,
      date            TEXT UNIQUE NOT NULL,
      sentiment_score REAL NOT NULL,
      signal          TEXT NOT NULL,
      summary         TEXT NOT NULL,
      risks           TEXT NOT NULL,
      top_headlines   TEXT NOT NULL,
      news_count      INTEGER NOT NULL,
      created_at      TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_reports_date ON reports(date DESC);
  `)
  return _db
}

type Row = Record<string, unknown>

export function rowToReport(row: Row): AnalysisReport {
  return {
    id:            row.id as string,
    date:          row.date as string,
    sentimentScore: row.sentiment_score as number,
    signal:        row.signal as AnalysisReport['signal'],
    summary:       row.summary as string,
    risks:         JSON.parse(row.risks as string),
    topHeadlines:  JSON.parse(row.top_headlines as string),
    newsCount:     row.news_count as number,
    createdAt:     row.created_at as string,
  }
}
