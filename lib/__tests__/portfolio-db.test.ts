import { describe, it, expect, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import path from 'path'
import { runMigrations } from '@/lib/db'
import { portfolioDbPath, runPortfolioMigrations } from '@/lib/portfolio-db'

const tables = (db: Database.Database): string[] =>
  (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as Array<{ name: string }>).map(r => r.name)

const saved = { portfolio: process.env.PORTFOLIO_DB_PATH, main: process.env.DATABASE_PATH }
afterEach(() => {
  for (const [key, value] of [['PORTFOLIO_DB_PATH', saved.portfolio], ['DATABASE_PATH', saved.main]] as const) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

describe('runPortfolioMigrations', () => {
  it('creates the personal tables', () => {
    const db = new Database(':memory:')
    runPortfolioMigrations(db)
    expect(tables(db)).toEqual(expect.arrayContaining(['holdings', 'trades', 'settings']))
  })

  it('is idempotent and keeps existing rows', () => {
    const db = new Database(':memory:')
    runPortfolioMigrations(db)
    db.prepare("INSERT INTO holdings (ticker, shares, avg_cost) VALUES ('0050.TW', 10, 60)").run()
    runPortfolioMigrations(db)
    expect(db.prepare('SELECT COUNT(*) AS n FROM holdings').get()).toEqual({ n: 1 })
  })
})

describe('separation from the tracked market database', () => {
  it('keeps personal tables out of the main (git-tracked) database', () => {
    const main = new Database(':memory:')
    runMigrations(main)
    const names = tables(main)
    expect(names).not.toContain('holdings')
    expect(names).not.toContain('trades')
  })
})

describe('portfolioDbPath', () => {
  it('defaults to portfolio.db next to the main database', () => {
    delete process.env.PORTFOLIO_DB_PATH
    process.env.DATABASE_PATH = '/somewhere/else/eco-news.db'
    expect(portfolioDbPath()).toBe(path.join('/somewhere/else', 'portfolio.db'))
  })

  it('honours PORTFOLIO_DB_PATH', () => {
    process.env.PORTFOLIO_DB_PATH = '/private/me.db'
    expect(portfolioDbPath()).toBe('/private/me.db')
  })
})
