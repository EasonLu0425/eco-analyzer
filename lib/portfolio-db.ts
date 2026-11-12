/**
 * The user's personal portfolio (holdings, trades, cash budget) lives in its own SQLite file,
 * separate from data/eco-news.db. The main database is committed to git; this one holds personal
 * financial data and is git-ignored (see .gitignore), so it never gets pushed by accident.
 *
 * Location: PORTFOLIO_DB_PATH, else portfolio.db next to the main database (so pointing
 * DATABASE_PATH at a scratch directory isolates both files).
 */
import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'

export function portfolioDbPath(): string {
  if (process.env.PORTFOLIO_DB_PATH) return process.env.PORTFOLIO_DB_PATH
  const mainPath = process.env.DATABASE_PATH ?? path.join(process.cwd(), 'data', 'eco-news.db')
  return path.join(path.dirname(mainPath), 'portfolio.db')
}

let _db: Database.Database | null = null

export function getPortfolioDb(): Database.Database {
  if (_db) return _db
  const file = portfolioDbPath()
  fs.mkdirSync(path.dirname(file), { recursive: true })
  _db = new Database(file)
  runPortfolioMigrations(_db)
  return _db
}

export function runPortfolioMigrations(db: Database.Database): void {
  db.exec(`
    -- Moving-average cost. A row with shares = 0 is a watched ticker.
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

    -- Key/value settings; 'cash' is the available budget in whole NT$.
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)
}
