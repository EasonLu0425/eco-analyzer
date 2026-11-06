/** Pure helpers for evaluating buy/sell rules against historical closes. No I/O. */

export interface ForwardSummary {
  n: number
  avg: number       // mean net return %
  median: number
  winRate: number   // % of trades with net return > 0
  worst: number     // worst single trade, net %
}

/** Simple moving average; null until `period` values are available. */
export function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null)
  let sum = 0
  for (let i = 0; i < values.length; i++) {
    sum += values[i]
    if (i >= period) sum -= values[i - period]
    if (i >= period - 1) out[i] = sum / period
  }
  return out
}

/** Fractional drop from the highest close in the trailing `window` bars (0 at a new high, else negative). */
export function drawdownFromHigh(closes: number[], window: number): number[] {
  return closes.map((c, i) => {
    const start = Math.max(0, i - window + 1)
    let hi = -Infinity
    for (let j = start; j <= i; j++) if (closes[j] > hi) hi = closes[j]
    return c / hi - 1
  })
}

/**
 * Collapse overlapping signals into independent episodes: keep a flagged index, then ignore
 * further flags for the next `cooldown` bars. Without this, one dip counts as many "samples".
 */
export function selectEpisodes(flags: boolean[], cooldown: number): number[] {
  const picked: number[] = []
  let blockedUntil = -1
  for (let i = 0; i < flags.length; i++) {
    if (flags[i] && i > blockedUntil) {
      picked.push(i)
      blockedUntil = i + cooldown
    }
  }
  return picked
}

/** Percentage change from close[i] to close[i + horizon]; indexes without a full window are dropped. */
export function forwardReturns(closes: number[], indexes: number[], horizon: number): number[] {
  const out: number[] = []
  for (const i of indexes) {
    if (i + horizon < closes.length) out.push((closes[i + horizon] / closes[i] - 1) * 100)
  }
  return out
}

/** Summarize trade returns (in %) after subtracting a round-trip cost (in %) from each. */
export function summarize(returns: number[], roundTripCostPct: number): ForwardSummary {
  if (returns.length === 0) return { n: 0, avg: 0, median: 0, winRate: 0, worst: 0 }

  const net = returns.map(r => r - roundTripCostPct)
  const sorted = [...net].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]

  return {
    n: net.length,
    avg: net.reduce((a, b) => a + b, 0) / net.length,
    median,
    winRate: (net.filter(r => r > 0).length / net.length) * 100,
    worst: sorted[0],
  }
}
