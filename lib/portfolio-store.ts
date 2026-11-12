/**
 * Persistence for the user's holdings, trades and cash budget, in the separate portfolio database
 * (see portfolio-db.ts). Every write validates its input and runs in one transaction, so a rejected
 * trade (not enough cash, selling more than held) leaves holdings, cash and the trade log untouched.
 */
import type Database from 'better-sqlite3'
import { getPortfolioDb } from './portfolio-db'
import {
  InputError, MAX_MONEY, applyTrade, cashDelta, parseHoldingInput, parseMoney, parseTradeInput, type Position, type Trade,
} from './portfolio'

const CASH_KEY = 'cash'

export interface Portfolio {
  cash: number
  holdings: Position[]
}

export interface StoredTrade extends Trade {
  id: number
}

const dbOrDefault = (db?: Database.Database): Database.Database => db ?? getPortfolioDb()

export function getCash(db?: Database.Database): number {
  const row = dbOrDefault(db).prepare('SELECT value FROM settings WHERE key = ?').get(CASH_KEY) as { value: string } | undefined
  const value = row == null ? 0 : Number(row.value)
  return Number.isFinite(value) ? value : 0
}

function writeCash(amount: number, db: Database.Database): void {
  if (amount < 0) throw new InputError('預算不足：金額不能低於 0')
  if (amount > MAX_MONEY) throw new InputError('預算超過上限')
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  ).run(CASH_KEY, String(amount))
}

export function setCash(amount: unknown, db?: Database.Database): void {
  const d = dbOrDefault(db)
  const value = parseMoney(amount, '預算')
  d.transaction(() => writeCash(value, d))()
}

/** Positive deposits, negative withdraws. The balance may not go below zero. */
export function adjustCash(delta: unknown, db?: Database.Database): number {
  const d = dbOrDefault(db)
  const change = parseMoney(delta, '預算調整金額')
  return d.transaction(() => {
    const next = getCash(d) + change
    writeCash(next, d)
    return next
  })()
}

export function getHoldings(db?: Database.Database): Position[] {
  return dbOrDefault(db)
    .prepare('SELECT ticker, shares, avg_cost AS avgCost FROM holdings ORDER BY ticker')
    .all() as Position[]
}

function upsertHolding(position: Position, d: Database.Database): void {
  d.prepare(
    `INSERT INTO holdings (ticker, shares, avg_cost) VALUES (?, ?, ?)
     ON CONFLICT(ticker) DO UPDATE SET shares = excluded.shares, avg_cost = excluded.avg_cost`,
  ).run(position.ticker, position.shares, position.avgCost)
}

/** Overwrite a holding as typed in by the user. Does not touch cash. */
export function setHolding(input: unknown, db?: Database.Database): Position {
  const position = parseHoldingInput(input)
  upsertHolding(position, dbOrDefault(db))
  return position
}

export function removeHolding(ticker: string, db?: Database.Database): void {
  dbOrDefault(db).prepare('DELETE FROM holdings WHERE ticker = ?').run(ticker)
}

/** Apply a buy or sell to the holding and the cash budget, and log it. All or nothing. */
export function recordTrade(input: unknown, db?: Database.Database): Position {
  const d = dbOrDefault(db)
  const trade = parseTradeInput(input)
  return d.transaction(() => {
    const current = getHoldings(d).find(h => h.ticker === trade.ticker) ?? null
    const next = applyTrade(current, trade)
    writeCash(getCash(d) + cashDelta(trade), d)
    upsertHolding(next, d)
    d.prepare(
      `INSERT INTO trades (date, ticker, side, shares, price, fee, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(trade.date, trade.ticker, trade.side, trade.shares, trade.price, trade.fee, new Date().toISOString())
    return next
  })()
}

export function getTrades(limit = 50, db?: Database.Database): StoredTrade[] {
  return dbOrDefault(db)
    .prepare('SELECT id, date, ticker, side, shares, price, fee FROM trades ORDER BY date DESC, id DESC LIMIT ?')
    .all(limit) as StoredTrade[]
}

export function getPortfolio(db?: Database.Database): Portfolio {
  const d = dbOrDefault(db)
  return { cash: getCash(d), holdings: getHoldings(d) }
}
