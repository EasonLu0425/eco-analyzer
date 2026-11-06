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
  runMigrations(_db)
  return _db
}

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS reports (
      id              TEXT PRIMARY KEY,
      date            TEXT UNIQUE NOT NULL,
      sentiment_score REAL NOT NULL,
      signal          TEXT NOT NULL,
      summary         TEXT NOT NULL,
      risks           TEXT NOT NULL,
      top_headlines   TEXT NOT NULL,
      news_count      INTEGER NOT NULL,
      created_at      TEXT NOT NULL,
      price_trends    TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_reports_date ON reports(date DESC);

    CREATE TABLE IF NOT EXISTS prices (
      ticker  TEXT NOT NULL,
      date    TEXT NOT NULL,
      open    REAL,
      high    REAL,
      low     REAL,
      close   REAL,
      volume  INTEGER,
      PRIMARY KEY (ticker, date)
    );
    CREATE INDEX IF NOT EXISTS idx_prices_ticker_date ON prices(ticker, date DESC);

    CREATE TABLE IF NOT EXISTS weekly_reports (
      id         TEXT PRIMARY KEY,
      week_start TEXT UNIQUE NOT NULL,
      data       TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_weekly_week_start ON weekly_reports(week_start DESC);

    CREATE TABLE IF NOT EXISTS monthly_reports (
      id         TEXT PRIMARY KEY,
      month      TEXT UNIQUE NOT NULL,
      data       TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_monthly_month ON monthly_reports(month DESC);

    CREATE TABLE IF NOT EXISTS news_items (
      url            TEXT PRIMARY KEY,
      title          TEXT NOT NULL,
      description    TEXT NOT NULL,
      published_at   TEXT NOT NULL,
      source         TEXT NOT NULL,
      collected_date TEXT NOT NULL,
      session        TEXT NOT NULL,
      collected_at   TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_news_collected_date ON news_items(collected_date, session);

    CREATE TABLE IF NOT EXISTS intraday_prices (
      ticker      TEXT NOT NULL,
      date        TEXT NOT NULL,
      session     TEXT NOT NULL,
      captured_at TEXT NOT NULL,
      price       REAL NOT NULL,
      open        REAL,
      high        REAL,
      low         REAL,
      volume      INTEGER,
      prev_close  REAL,
      market_time TEXT,
      PRIMARY KEY (ticker, date, session)
    );

    CREATE TABLE IF NOT EXISTS report_snapshots (
      date       TEXT NOT NULL,
      session    TEXT NOT NULL,
      data       TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (date, session)
    );

    CREATE TABLE IF NOT EXISTS meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)

  // Add price_trends to existing reports tables that predate this column
  const cols = db.prepare('PRAGMA table_info(reports)').all() as Array<{ name: string }>
  if (!cols.some(c => c.name === 'price_trends')) {
    db.exec('ALTER TABLE reports ADD COLUMN price_trends TEXT')
  }
}

type Row = Record<string, unknown>

export function rowToReport(row: Row): AnalysisReport {
  return {
    id:             row.id as string,
    date:           row.date as string,
    sentimentScore: row.sentiment_score as number,
    signal:         row.signal as AnalysisReport['signal'],
    summary:        row.summary as string,
    risks:          JSON.parse(row.risks as string),
    topHeadlines:   JSON.parse(row.top_headlines as string),
    newsCount:      row.news_count as number,
    createdAt:      row.created_at as string,
    priceTrends:    row.price_trends ? JSON.parse(row.price_trends as string) : undefined,
  }
}
