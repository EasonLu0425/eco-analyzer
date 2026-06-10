import type { PriceRecord, TechnicalIndicators } from '@/types'

function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1)
  const result: number[] = new Array(values.length).fill(NaN)
  if (values.length < period) return result
  let sum = 0
  for (let i = 0; i < period; i++) sum += values[i]
  result[period - 1] = sum / period
  for (let i = period; i < values.length; i++) {
    result[i] = values[i] * k + result[i - 1] * (1 - k)
  }
  return result
}

function sma(values: number[], period: number, index: number): number {
  let sum = 0
  for (let i = index - period + 1; i <= index; i++) sum += values[i]
  return sum / period
}

function stddev(values: number[], period: number, index: number): number {
  const mean = sma(values, period, index)
  let variance = 0
  for (let i = index - period + 1; i <= index; i++) variance += (values[i] - mean) ** 2
  return Math.sqrt(variance / period)
}

export function computeRSI(closes: number[], period = 14): (number | null)[] {
  const result: (number | null)[] = new Array(closes.length).fill(null)
  if (closes.length < period + 1) return result

  let avgGain = 0
  let avgLoss = 0
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1]
    if (diff > 0) avgGain += diff
    else avgLoss += -diff
  }
  avgGain /= period
  avgLoss /= period

  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1]
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period
    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
  }

  return result
}

export function computeMACD(
  closes: number[],
  fast = 12,
  slow = 26,
  signal = 9,
): { line: (number | null)[]; signalLine: (number | null)[]; histogram: (number | null)[] } {
  const n = closes.length
  const line: (number | null)[] = new Array(n).fill(null)
  const signalLine: (number | null)[] = new Array(n).fill(null)
  const histogram: (number | null)[] = new Array(n).fill(null)

  if (n < slow) return { line, signalLine, histogram }

  const ema12 = ema(closes, fast)
  const ema26 = ema(closes, slow)

  const macdValues: (number | null)[] = new Array(n).fill(null)
  for (let i = slow - 1; i < n; i++) {
    if (!isNaN(ema12[i]) && !isNaN(ema26[i])) {
      macdValues[i] = ema12[i] - ema26[i]
      line[i] = macdValues[i]
    }
  }

  const firstIdx = macdValues.findIndex(v => v !== null)
  if (firstIdx === -1) return { line, signalLine, histogram }

  const k = 2 / (signal + 1)
  let validCount = 0
  let prevSig = 0

  for (let i = firstIdx; i < n; i++) {
    if (macdValues[i] === null) continue
    validCount++
    const v = macdValues[i] as number
    if (validCount < signal) {
      prevSig += v
    } else if (validCount === signal) {
      prevSig = (prevSig + v) / signal
      signalLine[i] = prevSig
      histogram[i] = v - prevSig
    } else {
      prevSig = v * k + prevSig * (1 - k)
      signalLine[i] = prevSig
      histogram[i] = v - prevSig
    }
  }

  return { line, signalLine, histogram }
}

export function computeBollinger(
  closes: number[],
  period = 20,
  multiplier = 2,
): {
  upper: (number | null)[]
  middle: (number | null)[]
  lower: (number | null)[]
  position: (number | null)[]
} {
  const n = closes.length
  const upper: (number | null)[] = new Array(n).fill(null)
  const middle: (number | null)[] = new Array(n).fill(null)
  const lower: (number | null)[] = new Array(n).fill(null)
  const position: (number | null)[] = new Array(n).fill(null)

  if (n < period) return { upper, middle, lower, position }

  for (let i = period - 1; i < n; i++) {
    const mean = sma(closes, period, i)
    const std = stddev(closes, period, i)
    const u = mean + multiplier * std
    const l = mean - multiplier * std
    upper[i] = u
    middle[i] = mean
    lower[i] = l
    position[i] = std === 0 ? 50 : ((closes[i] - l) / (u - l)) * 100
  }

  return { upper, middle, lower, position }
}

export function computeIndicators(records: PriceRecord[], ticker = ''): TechnicalIndicators[] {
  const closes = records.map(r => r.close)
  const rsi = computeRSI(closes)
  const { line: macdLine, signalLine: macdSig, histogram: macdHist } = computeMACD(closes)
  const { upper: bbU, middle: bbM, lower: bbL, position: bbPos } = computeBollinger(closes)

  return records.map((r, i) => ({
    ticker,
    date: r.date,
    rsi14: rsi[i],
    macdLine: macdLine[i],
    macdSignal: macdSig[i],
    macdHistogram: macdHist[i],
    bbUpper: bbU[i],
    bbMiddle: bbM[i],
    bbLower: bbL[i],
    bbPosition: bbPos[i],
  }))
}
