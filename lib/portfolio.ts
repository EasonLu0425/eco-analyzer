/**
 * Portfolio math and input validation. Pure, no I/O.
 *
 * Cost basis uses the moving-average method: a buy blends the average cost (fee included),
 * a sell leaves the average cost unchanged. Money is in NT$, quantities are whole shares.
 */
import { isIsoDate } from './watch-keys'

/** A user-correctable problem (bad input, not enough cash). API routes show its message; other errors stay private. */
export class InputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InputError'
  }
}

export interface Position {
  ticker: string
  shares: number
  avgCost: number
}

export type TradeSide = 'buy' | 'sell'

export interface Trade {
  ticker: string
  side: TradeSide
  shares: number
  price: number
  fee: number
  date: string
}

export interface PositionPnl {
  marketValue: number | null
  costBasis: number
  pnl: number | null
  pnlPct: number | null
}

const TICKER_PATTERN = /^[0-9]{4,6}[A-Z]?\.TWO?$/   // TWSE (.TW) and TPEx/OTC (.TWO)
const MAX_SHARES = 1_000_000_000
const MAX_PRICE = 1_000_000
const MAX_FEE = 10_000_000
/** Largest cash balance or single adjustment, far below 2^53 so whole-dollar arithmetic stays exact. */
export const MAX_MONEY = 1_000_000_000_000
const COST_DECIMALS = 4

const roundTo = (v: number, digits: number): number => {
  const k = 10 ** digits
  return Math.round(v * k) / k
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

export function parseTicker(v: unknown): string {
  if (typeof v !== 'string' || !TICKER_PATTERN.test(v)) throw new InputError('代號格式不正確（例如 0050.TW）')
  return v
}

function parseShares(v: unknown, { allowZero }: { allowZero: boolean }): number {
  const min = allowZero ? 0 : 1
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > MAX_SHARES) {
    throw new InputError(`股數必須是 ${min} 到 ${MAX_SHARES} 的整數`)
  }
  return v
}

function parsePositive(v: unknown, label: string, max: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0 || v > max) {
    throw new InputError(`${label}必須是大於 0 的數字`)
  }
  return v
}

/** Validates a manually entered holding. Zero shares keeps the ticker on the watch list with no cost. */
export function parseHoldingInput(input: unknown): Position {
  if (!isRecord(input)) throw new InputError('庫存必須是物件')
  const ticker = parseTicker(input.ticker)
  const shares = parseShares(input.shares, { allowZero: true })
  if (shares === 0) return { ticker, shares: 0, avgCost: 0 }
  const avgCost = roundTo(parsePositive(input.avgCost, '成本', MAX_PRICE), COST_DECIMALS)
  return { ticker, shares, avgCost }
}

export function parseTradeInput(input: unknown): Trade {
  if (!isRecord(input)) throw new InputError('交易必須是物件')
  const ticker = parseTicker(input.ticker)
  if (input.side !== 'buy' && input.side !== 'sell') throw new InputError('買賣方向必須是 buy 或 sell')
  const shares = parseShares(input.shares, { allowZero: false })
  const price = parsePositive(input.price, '價格', MAX_PRICE)
  const fee = input.fee ?? 0
  if (typeof fee !== 'number' || !Number.isFinite(fee) || fee < 0 || fee > MAX_FEE) {
    throw new InputError('手續費必須是 0 以上的數字')
  }
  if (typeof input.date !== 'string' || !isIsoDate(input.date)) throw new InputError('日期格式必須是 YYYY-MM-DD')
  return { ticker, side: input.side, shares, price, fee, date: input.date }
}

/** A whole-dollar amount of money; negative values are allowed (used for withdrawals). */
export function parseMoney(v: unknown, label: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || Math.abs(v) > MAX_MONEY) {
    throw new InputError(`${label}必須是有效的數字`)
  }
  return Math.round(v)
}

/** Position after the trade. Selling more than is held is rejected. */
export function applyTrade(position: Readonly<Position> | null, trade: Readonly<Trade>): Position {
  const held = position?.shares ?? 0
  if (trade.side === 'sell') {
    if (trade.shares > held) throw new InputError(`${trade.ticker} 只持有 ${held} 股，無法賣出 ${trade.shares} 股`)
    const left = held - trade.shares
    return { ticker: trade.ticker, shares: left, avgCost: left === 0 ? 0 : (position?.avgCost ?? 0) }
  }
  const spent = (position?.avgCost ?? 0) * held + trade.shares * trade.price + trade.fee
  const shares = held + trade.shares
  return { ticker: trade.ticker, shares, avgCost: roundTo(spent / shares, COST_DECIMALS) }
}

/** Cash movement of a trade in whole dollars: negative for a buy (price x shares + fee), positive for a sell. */
export function cashDelta(trade: Readonly<Trade>): number {
  const gross = trade.shares * trade.price
  return Math.round(trade.side === 'buy' ? -(gross + trade.fee) : gross - trade.fee)
}

export function positionPnl(position: Readonly<Position>, price: number | null): PositionPnl {
  const costBasis = position.shares * position.avgCost
  if (price == null) return { marketValue: null, costBasis, pnl: null, pnlPct: null }
  const marketValue = position.shares * price
  return {
    marketValue,
    costBasis,
    pnl: marketValue - costBasis,
    pnlPct: costBasis > 0 ? (marketValue - costBasis) / costBasis : null,
  }
}
