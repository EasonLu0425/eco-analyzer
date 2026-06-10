import type { BacktestResult, Trade, ETFSignal } from '@/types'

const BUY_SIGNALS: ETFSignal[] = ['buy', 'strong-buy']
const SELL_SIGNALS: ETFSignal[] = ['avoid', 'strong-avoid']

function annualized(totalReturnPct: number, days: number): number {
  if (days <= 0) return 0
  return (Math.pow(1 + totalReturnPct / 100, 365 / days) - 1) * 100
}

function calcMaxDrawdown(equityValues: number[]): number {
  let peak = equityValues[0] ?? 100
  let maxDD = 0
  for (const v of equityValues) {
    if (v > peak) peak = v
    const dd = peak > 0 ? (peak - v) / peak : 0
    if (dd > maxDD) maxDD = dd
  }
  return maxDD * 100
}

export function runBacktest(
  reports: { date: string; signal: ETFSignal }[],
  prices: Map<string, number>,
  ticker: string,
): BacktestResult {
  const sorted = [...reports].sort((a, b) => a.date.localeCompare(b.date))
  const trades: Trade[] = []
  let entryDate: string | null = null
  let entryPrice = 0
  let entrySignal: ETFSignal = 'hold'

  for (const r of sorted) {
    const price = prices.get(r.date)
    if (price == null) continue

    if (entryDate === null && BUY_SIGNALS.includes(r.signal)) {
      entryDate = r.date
      entryPrice = price
      entrySignal = r.signal
    } else if (entryDate !== null && SELL_SIGNALS.includes(r.signal)) {
      const holdingDays = Math.round(
        (new Date(r.date).getTime() - new Date(entryDate).getTime()) / 86400000,
      )
      trades.push({
        entryDate,
        exitDate: r.date,
        entryPrice,
        exitPrice: price,
        returnPct: ((price - entryPrice) / entryPrice) * 100,
        holdingDays,
        signal: entrySignal,
      })
      entryDate = null
    }
  }

  // Close open position at last available price date
  if (entryDate !== null) {
    const allPriceDates = [...prices.keys()].sort()
    const lastPriceDate = allPriceDates[allPriceDates.length - 1]
    if (lastPriceDate) {
      const lastPrice = prices.get(lastPriceDate)!
      const holdingDays = Math.round(
        (new Date(lastPriceDate).getTime() - new Date(entryDate).getTime()) / 86400000,
      )
      trades.push({
        entryDate,
        exitDate: lastPriceDate,
        entryPrice,
        exitPrice: lastPrice,
        returnPct: ((lastPrice - entryPrice) / entryPrice) * 100,
        holdingDays,
        signal: entrySignal,
      })
    }
  }

  const allDates = [...prices.keys()].sort()
  const equityCurve: { date: string; value: number }[] = []

  for (const date of allDates) {
    const activeTrade = trades.find(t => date >= t.entryDate && date <= t.exitDate)
    const priorReturn = trades
      .filter(t => t.exitDate < (activeTrade?.entryDate ?? date))
      .reduce((acc, t) => acc * (1 + t.returnPct / 100), 1)

    let value: number
    if (activeTrade) {
      const dayPrice = prices.get(date)!
      value = 100 * priorReturn * (dayPrice / activeTrade.entryPrice)
    } else {
      const completedReturn = trades
        .filter(t => t.exitDate <= date)
        .reduce((acc, t) => acc * (1 + t.returnPct / 100), 1)
      value = 100 * completedReturn
    }
    equityCurve.push({ date, value: Math.round(value * 100) / 100 })
  }

  const totalReturnMultiple = trades.reduce((acc, t) => acc * (1 + t.returnPct / 100), 1)
  const totalReturn = Math.round((totalReturnMultiple - 1) * 10000) / 100
  const winRate =
    trades.length > 0
      ? Math.round((trades.filter(t => t.returnPct > 0).length / trades.length) * 10000) / 100
      : 0

  return {
    ticker,
    fromDate: allDates[0] ?? '',
    toDate: allDates[allDates.length - 1] ?? '',
    totalReturn,
    annualizedReturn: Math.round(annualized(totalReturn, allDates.length) * 100) / 100,
    maxDrawdown: Math.round(calcMaxDrawdown(equityCurve.map(e => e.value)) * 100) / 100,
    winRate,
    tradeCount: trades.length,
    trades,
    equityCurve,
  }
}
