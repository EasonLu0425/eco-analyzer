import type { FearGreedIndex, PriceTrend } from '@/types'

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val))
}

function get52wPosition(trend: PriceTrend): number {
  const range = trend.high52w - trend.low52w
  if (range <= 0) return 50
  return clamp(((trend.currentClose - trend.low52w) / range) * 100, 0, 100)
}

function getMomentumComponent(change30d: number): number {
  // +20% → 100, 0% → 50, -20% → 0
  return clamp(50 + change30d * 2.5, 0, 100)
}

function scoreToLabel(score: number): FearGreedIndex['label'] {
  if (score < 20) return 'extreme-fear'
  if (score < 40) return 'fear'
  if (score < 60) return 'neutral'
  if (score < 80) return 'greed'
  return 'extreme-greed'
}

export function computeFearGreed(
  sentimentScore: number,
  primaryTrend: PriceTrend | null,
  date?: string,
): FearGreedIndex {
  const today = date ?? new Date().toISOString().slice(0, 10)

  const sentimentComponent = clamp(sentimentScore * 10, 0, 100)
  const weeklyPosition = primaryTrend ? get52wPosition(primaryTrend) : 50
  const momentum = primaryTrend ? getMomentumComponent(primaryTrend.change30d) : 50

  const score = clamp(
    Math.round(sentimentComponent * 0.4 + weeklyPosition * 0.3 + momentum * 0.3),
    0,
    100,
  )

  return {
    date: today,
    score,
    label: scoreToLabel(score),
    components: {
      sentiment: Math.round(sentimentComponent),
      weeklyPosition: Math.round(weeklyPosition),
      momentum: Math.round(momentum),
    },
  }
}
