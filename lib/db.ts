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

    -- Point-in-time market series (institutional flows, margin balance, monthly revenue YoY, ...).
    -- date is when the value became publicly known, so a lookup "as of D" cannot see the future.
    CREATE TABLE IF NOT EXISTS macro_series (
      series TEXT NOT NULL,
      date   TEXT NOT NULL,
      value  REAL NOT NULL,
      PRIMARY KEY (series, date)
    );

    -- Long-horizon qualitative watch signals judged from each day's news (see eco-analyze Step 2.7).
    -- Only days where the news actually said something are stored; no row means "no news", not "steady".
    CREATE TABLE IF NOT EXISTS watch_signals (
      date   TEXT NOT NULL,
      key    TEXT NOT NULL,
      status TEXT NOT NULL,
      note   TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT '',
      PRIMARY KEY (date, key)
    );

    -- The user's own positions (moving-average cost). A row with shares = 0 is a watched ticker.
    -- Cash lives in meta under 'portfolio_cash'.
    CREATE TABLE IF NOT EXISTS holdings (
      ticker   TEXT PRIMARY KEY,
      shares   INTEGER NOT NULL,
      avg_cost REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS trades (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      date       TEXT NOT NULL,
      ticker     TEXT NOT NULL,
      side       TEXT NOT NULL,
      shares     INTEGER NOT NULL,
      price      REAL NOT NULL,
      fee        REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_trades_date ON trades(date DESC, id DESC);
  `)

  const watchCols = db.prepare('PRAGMA table_info(watch_signals)').all() as Array<{ name: string }>
  if (!watchCols.some(c => c.name === 'source')) {
    db.exec("ALTER TABLE watch_signals ADD COLUMN source TEXT NOT NULL DEFAULT ''")
  }

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
