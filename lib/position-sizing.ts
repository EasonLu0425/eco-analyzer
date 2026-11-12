/**
 * Position sizing: how much of the budget to put to work today. Pure, no I/O.
 *
 * Design follows the research in data/studies/: direction (news score, 7 structured factors,
 * technical buy/sell rules) showed no reliable predictive power, volatility did. So:
 *   - TARGET EXPOSURE (how much of total assets should be in ETFs) depends only on risk:
 *     trend (MA200 / MA60) and the volatility regime. The news signal does not move it.
 *   - PACE (how fast to move toward the target) is where the daily signal acts:
 *     strong-buy/buy = full step, hold = half, avoid/strong-avoid = pause new buying.
 *   - Each step is capped at a fraction of total assets, so money goes in over several days.
 *
 * Total assets = holdings at market + cash. Targets are split equally across tracked tickers.
 * Fees and taxes are not modelled; the advice is a planning aid, not a recommendation to trade.
 */
import type { ETFSignal } from '@/types'
import { volRegime, type VolRegime } from './vol-forecast'

export const SIZING = {
  baseExposure: 0.7,
  trendUp: 0.1,          // above MA200 and MA60 rising
  trendDown: -0.2,       // below MA200
  volAdjust: { low: 0.05, normal: 0, high: -0.1, extreme: -0.2, unknown: 0 } satisfies Record<VolRegime, number>,
  stepFraction: 0.25,    // max share of total assets moved in one step
  rebalanceBand: 0.1,    // trim only when exposure exceeds target by more than this
  pace: { 'strong-buy': 1, buy: 1, hold: 0.5, avoid: 0, 'strong-avoid': 0 } satisfies Record<ETFSignal, number>,
} as const

export interface MarketContext {
  signal: ETFSignal
  aboveMa200: boolean | null
  ma60Rising: boolean | null
  volPercentile: number | null
}

export interface SizingPosition {
  ticker: string
  shares: number
  avgCost: number
  price: number | null
}

export interface SizingInput {
  market: MarketContext
  cash: number
  positions: readonly SizingPosition[]
}

export type LineAction = 'buy' | 'trim' | 'hold'

export interface AllocationLine {
  ticker: string
  action: LineAction
  shares: number            // shares to buy or trim; 0 for hold
  amount: number            // NT$ for those shares
  price: number | null
  currentWeight: number     // share of total assets
  targetWeight: number
  pnlPct: number | null     // unrealized return on cost
}

export interface SizingFactor {
  label: string
  delta: number
  detail: string
}

export interface AllocationAdvice {
  targetExposure: number
  currentExposure: number
  totalValue: number
  cash: number
  pace: number
  factors: SizingFactor[]
  budgetToDeploy: number
  lines: AllocationLine[]
  notes: string[]
}

/** Exposure shares are sums of floats (0.7 - 0.2 is 0.49999999999999994); keep the band edge from flipping on that noise. */
const BAND_EPSILON = 1e-9

const VOL_LABEL: Record<VolRegime, string> = {
  low: '低波動', normal: '一般波動', high: '高波動', extreme: '極端高波動', unknown: '波動資料不足',
}

function buildFactors(m: MarketContext, notes: string[]): SizingFactor[] {
  let trend: SizingFactor
  if (m.aboveMa200 == null) {
    notes.push('趨勢資料不足（需要 200 日價格），趨勢以中性計算')
    trend = { label: '趨勢', delta: 0, detail: '資料不足，視為中性' }
  } else if (!m.aboveMa200) {
    trend = { label: '趨勢', delta: SIZING.trendDown, detail: '跌破 MA200（下跌趨勢）' }
  } else if (m.ma60Rising) {
    trend = { label: '趨勢', delta: SIZING.trendUp, detail: '站上 MA200 且 MA60 向上' }
  } else {
    trend = { label: '趨勢', delta: 0, detail: '站上 MA200 但 MA60 未向上' }
  }

  const regime = volRegime(m.volPercentile)
  if (regime === 'unknown') notes.push('波動資料不足，波動以一般計算')
  const vol: SizingFactor = { label: '波動', delta: SIZING.volAdjust[regime], detail: VOL_LABEL[regime] }

  return [{ label: '基準', delta: SIZING.baseExposure, detail: '預設的股票曝險比例' }, trend, vol]
}

interface Priced extends SizingPosition { price: number; value: number }

const hasPrice = (p: SizingPosition): p is Priced & SizingPosition => p.price != null && p.price > 0

/** Whole-share order for `amount`; shares and the exact cost it implies. */
const toShares = (amount: number, price: number, cap = Infinity): { shares: number; amount: number } => {
  const shares = Math.min(Math.floor(amount / price), cap)
  return { shares, amount: shares * price }
}

export function suggestAllocation(input: SizingInput): AllocationAdvice {
  const { market, cash, positions } = input
  const notes: string[] = []
  const factors = buildFactors(market, notes)
  const targetExposure = factors.reduce((s, f) => s + f.delta, 0)
  const pace = SIZING.pace[market.signal]

  const priced = positions.filter(hasPrice).map(p => ({ ...p, value: p.shares * p.price }))
  const heldUnpriced = positions.filter(p => p.shares > 0 && !hasPrice(p))
  for (const p of positions.filter(q => !hasPrice(q))) {
    notes.push(p.shares > 0
      ? `${p.ticker} 持有中但沒有報價，總資產會被低估，暫不建議（請先更新價格）`
      : `${p.ticker} 沒有報價，不納入配置（請先更新價格）`)
  }

  const holdingsValue = priced.reduce((s, p) => s + p.value, 0)
  const totalValue = holdingsValue + cash
  const currentExposure = totalValue > 0 ? holdingsValue / totalValue : 0

  const emptyLine = (p: SizingPosition): AllocationLine => {
    const price = hasPrice(p) ? p.price : null
    const cost = p.shares * p.avgCost
    const value = price != null ? p.shares * price : null
    return {
      ticker: p.ticker, action: 'hold', shares: 0, amount: 0, price,
      currentWeight: value != null && totalValue > 0 ? value / totalValue : 0,
      targetWeight: positions.length > 0 ? targetExposure / positions.length : 0,
      pnlPct: value != null && cost > 0 ? (value - cost) / cost : null,
    }
  }
  const idle = (): AllocationAdvice => ({
    targetExposure, currentExposure, totalValue, cash, pace, factors, budgetToDeploy: 0, lines: positions.map(emptyLine), notes,
  })

  if (positions.length === 0) {
    notes.push('尚未輸入任何庫存或關注標的，請先在「持倉」頁新增')
    return idle()
  }
  if (heldUnpriced.length > 0 || priced.length === 0) return idle()
  if (totalValue <= 0) {
    notes.push('預算與庫存都是 0，沒有可配置的資金')
    return idle()
  }

  const tickerTarget = (targetExposure * totalValue) / priced.length
  const gaps = priced.map(p => ({ p, gap: tickerTarget - p.value }))
  const stepCap = SIZING.stepFraction * totalValue

  const excess = currentExposure - targetExposure
  const shouldTrim = excess > SIZING.rebalanceBand + BAND_EPSILON
  const buyGaps = shouldTrim ? [] : gaps.filter(g => g.gap > 0)
  const totalGap = buyGaps.reduce((s, g) => s + g.gap, 0)

  // Per-ticker gaps ignore overweight tickers, so also cap by the room left under the overall target.
  const roomToTarget = Math.max(0, targetExposure * totalValue - holdingsValue)
  const buyBudget = Math.min(totalGap, roomToTarget, cash, stepCap * pace)
  if (cash <= 0) notes.push('預算已用完，沒有可買進的資金；可在持倉頁增加預算')
  else if (!shouldTrim && totalGap > 0 && pace === 0) notes.push('今日訊號偏空，暫停新增買進，等訊號回到持平以上再往目標靠近')

  const trimBudget = shouldTrim ? Math.min((excess * totalValue), stepCap) : 0
  const trimGaps = gaps.filter(g => g.gap < 0)
  const totalOver = trimGaps.reduce((s, g) => s - g.gap, 0)
  if (shouldTrim) notes.push('目前曝險明顯高於風險目標，建議分批降低；賣出前請先考慮稅費與長期計畫')

  const lines = positions.map((pos): AllocationLine => {
    const base = emptyLine(pos)
    const priceOf = base.price
    if (priceOf == null) return base

    const buy = buyGaps.find(g => g.p.ticker === pos.ticker)
    if (buy && totalGap > 0 && buyBudget > 0) {
      const order = toShares((buyBudget * buy.gap) / totalGap, priceOf)
      if (order.shares > 0) return { ...base, action: 'buy', ...order }
    }
    const over = trimGaps.find(g => g.p.ticker === pos.ticker)
    if (over && totalOver > 0 && trimBudget > 0) {
      const order = toShares((trimBudget * -over.gap) / totalOver, priceOf, pos.shares)
      if (order.shares > 0) return { ...base, action: 'trim', ...order }
    }
    return base
  })

  const budgetToDeploy = lines.reduce((s, l) => s + (l.action === 'buy' ? l.amount : 0), 0)
  return { targetExposure, currentExposure, totalValue, cash, pace, factors, budgetToDeploy, lines, notes }
}
