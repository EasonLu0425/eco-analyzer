import { describe, it, expect } from 'vitest'
import { scoreToSignal, computeTechnicalScore, applyTechnicalVeto, computeFinalSignal } from '../signal'
import type { TechnicalIndicators } from '@/types'

function indicators(overrides: Partial<TechnicalIndicators> = {}): TechnicalIndicators {
  return {
    ticker: '0050.TW',
    date: '2026-08-24',
    rsi14: null,
    macdLine: null,
    macdSignal: null,
    macdHistogram: null,
    bbUpper: null,
    bbMiddle: null,
    bbLower: null,
    bbPosition: null,
    ...overrides,
  }
}

describe('scoreToSignal', () => {
  it('returns strong-buy at and above 8.5', () => {
    expect(scoreToSignal(8.5)).toBe('strong-buy')
    expect(scoreToSignal(10)).toBe('strong-buy')
  })

  it('returns buy for 7 up to but excluding 8.5', () => {
    expect(scoreToSignal(7)).toBe('buy')
    expect(scoreToSignal(8.49)).toBe('buy')
  })

  it('returns hold for 4 up to but excluding 7', () => {
    expect(scoreToSignal(4)).toBe('hold')
    expect(scoreToSignal(6.99)).toBe('hold')
  })

  it('returns avoid for 2 up to but excluding 4', () => {
    expect(scoreToSignal(2)).toBe('avoid')
    expect(scoreToSignal(3.99)).toBe('avoid')
  })

  it('returns strong-avoid below 2', () => {
    expect(scoreToSignal(0)).toBe('strong-avoid')
    expect(scoreToSignal(1.99)).toBe('strong-avoid')
  })

  it('has no overlapping boundary at score 8 (previous bug)', () => {
    expect(scoreToSignal(8)).toBe('buy')
  })
})

describe('computeTechnicalScore', () => {
  it('returns neutral 5 when indicators are null', () => {
    expect(computeTechnicalScore(null)).toBe(5)
  })

  it('returns neutral 5 when all sub-indicators are unavailable', () => {
    expect(computeTechnicalScore(indicators())).toBe(5)
  })

  it('scores high (bullish) on oversold RSI', () => {
    const score = computeTechnicalScore(indicators({ rsi14: 20 }))
    expect(score).toBeGreaterThan(5)
  })

  it('scores low (bearish) on overbought RSI', () => {
    const score = computeTechnicalScore(indicators({ rsi14: 80 }))
    expect(score).toBeLessThan(5)
  })

  it('scores high on positive MACD histogram', () => {
    const score = computeTechnicalScore(indicators({ macdHistogram: 1.5 }))
    expect(score).toBeGreaterThan(5)
  })

  it('scores low on negative MACD histogram', () => {
    const score = computeTechnicalScore(indicators({ macdHistogram: -1.5 }))
    expect(score).toBeLessThan(5)
  })

  it('scores high when price sits near lower Bollinger band', () => {
    const score = computeTechnicalScore(indicators({ bbPosition: 10 }))
    expect(score).toBeGreaterThan(5)
  })

  it('scores low when price sits near upper Bollinger band', () => {
    const score = computeTechnicalScore(indicators({ bbPosition: 90 }))
    expect(score).toBeLessThan(5)
  })

  it('averages only the available sub-indicators', () => {
    const score = computeTechnicalScore(indicators({ rsi14: 20, macdHistogram: null, bbPosition: null }))
    expect(score).toBe(8)
  })
})

describe('applyTechnicalVeto', () => {
  it('leaves signal unchanged when technical score meets the threshold', () => {
    expect(applyTechnicalVeto('buy', 4)).toBe('buy')
    expect(applyTechnicalVeto('buy', 10)).toBe('buy')
  })

  it('downgrades buy to hold when technical score is below threshold', () => {
    expect(applyTechnicalVeto('buy', 3.9)).toBe('hold')
  })

  it('downgrades strong-buy to buy when technical score is below threshold', () => {
    expect(applyTechnicalVeto('strong-buy', 3.9)).toBe('buy')
  })

  it('never upgrades a signal, even with a strongly bullish technical score', () => {
    expect(applyTechnicalVeto('hold', 10)).toBe('hold')
    expect(applyTechnicalVeto('avoid', 10)).toBe('avoid')
  })

  it('leaves hold/avoid/strong-avoid untouched regardless of technical score', () => {
    expect(applyTechnicalVeto('hold', 0)).toBe('hold')
    expect(applyTechnicalVeto('avoid', 0)).toBe('avoid')
    expect(applyTechnicalVeto('strong-avoid', 0)).toBe('strong-avoid')
  })

  it('respects a custom threshold', () => {
    expect(applyTechnicalVeto('buy', 4.5, 5)).toBe('hold')
    expect(applyTechnicalVeto('buy', 5, 5)).toBe('buy')
  })
})

describe('computeFinalSignal', () => {
  it('combines scoreToSignal with the technical veto', () => {
    expect(computeFinalSignal(7, 5)).toBe('buy')
    expect(computeFinalSignal(7, 2)).toBe('hold')
    expect(computeFinalSignal(3, 0)).toBe('avoid')
  })
})
