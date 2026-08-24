import type { ETFSignal, TechnicalIndicators } from '@/types'

export function scoreToSignal(score: number): ETFSignal {
  if (score >= 8.5) return 'strong-buy'
  if (score >= 7) return 'buy'
  if (score >= 4) return 'hold'
  if (score >= 2) return 'avoid'
  return 'strong-avoid'
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val))
}

// RSI < 30 = oversold (bullish entry), RSI > 70 = overbought (bearish)
function rsiScore(rsi: number | null): number | null {
  if (rsi === null) return null
  return clamp(10 - rsi / 10, 0, 10)
}

// Positive histogram = bullish momentum, negative = bearish
function macdScore(histogram: number | null): number | null {
  if (histogram === null) return null
  if (histogram > 0) return 7
  if (histogram < 0) return 3
  return 5
}

// Position near lower band (0) = potential bounce (bullish), near upper band (100) = overbought
function bollingerScore(position: number | null): number | null {
  if (position === null) return null
  return clamp(10 - position / 10, 0, 10)
}

// Blends RSI + MACD + Bollinger band position into a single 0–10 technical score.
// Falls back to neutral (5) when there isn't enough price history for a sub-indicator.
export function computeTechnicalScore(indicators: TechnicalIndicators | null): number {
  if (!indicators) return 5

  const parts = [
    rsiScore(indicators.rsi14),
    macdScore(indicators.macdHistogram),
    bollingerScore(indicators.bbPosition),
  ].filter((v): v is number => v !== null)

  if (parts.length === 0) return 5
  return parts.reduce((a, b) => a + b, 0) / parts.length
}

const DOWNGRADE: Partial<Record<ETFSignal, ETFSignal>> = {
  'strong-buy': 'buy',
  buy: 'hold',
}

// Cross-check only: a below-neutral technical read (RSI/MACD/Bollinger broadly
// disagreeing with the news) downgrades a buy-tier call by one notch. It never
// upgrades a call — with ~50 days of history there isn't enough data to trust a
// finely-tuned numeric blend, so this stays a conservative, explainable veto
// rather than an optimized weighted average (an earlier 50/50 average was tried
// and actually destroyed the technical score's own predictive edge — averaging
// a noisy signal into a good one dilutes the good one).
export function applyTechnicalVeto(
  signal: ETFSignal,
  technicalScore: number,
  threshold = 4,
): ETFSignal {
  if (technicalScore >= threshold) return signal
  return DOWNGRADE[signal] ?? signal
}

export function computeFinalSignal(sentimentScore: number, technicalScore: number): ETFSignal {
  return applyTechnicalVeto(scoreToSignal(sentimentScore), technicalScore)
}
