import { describe, it, expect } from 'vitest'
import type { AnalysisReport, PriceRecord } from '@/types'
import {
  dominantSignal,
  sentimentTrend,
  computePricePerformance,
  aggregateDailyReports,
} from '../report-aggregator'

// ── dominantSignal ──────────────────────────────────────────────────────────

describe('dominantSignal', () => {
  it('returns most frequent signal', () => {
    expect(dominantSignal(['buy', 'buy', 'hold'])).toBe('buy')
  })

  it('returns hold for empty array', () => {
    expect(dominantSignal([])).toBe('hold')
  })

  it('on tie prefers the more bullish signal', () => {
    // buy vs hold tie → buy is more bullish
    expect(dominantSignal(['buy', 'hold'])).toBe('buy')
  })

  it('on tie strong-buy beats buy', () => {
    expect(dominantSignal(['strong-buy', 'buy'])).toBe('strong-buy')
  })

  it('on tie avoid beats strong-avoid', () => {
    expect(dominantSignal(['avoid', 'strong-avoid'])).toBe('avoid')
  })

  it('single element array returns that element', () => {
    expect(dominantSignal(['strong-avoid'])).toBe('strong-avoid')
  })

  it('all same signals returns that signal', () => {
    expect(dominantSignal(['hold', 'hold', 'hold'])).toBe('hold')
  })
})

// ── sentimentTrend ──────────────────────────────────────────────────────────

describe('sentimentTrend', () => {
  it('returns improving when second half avg > first half by more than 0.5', () => {
    // first half: [3, 4] avg=3.5, second half: [7, 8] avg=7.5
    expect(sentimentTrend([3, 4, 7, 8])).toBe('improving')
  })

  it('returns declining when first half avg > second half by more than 0.5', () => {
    // first half: [8, 7] avg=7.5, second half: [4, 3] avg=3.5
    expect(sentimentTrend([8, 7, 4, 3])).toBe('declining')
  })

  it('returns stable when difference is within 0.5', () => {
    expect(sentimentTrend([5, 5, 5, 5])).toBe('stable')
  })

  it('returns stable for single element', () => {
    expect(sentimentTrend([7])).toBe('stable')
  })

  it('returns stable for empty array', () => {
    expect(sentimentTrend([])).toBe('stable')
  })

  it('handles odd-length array (first half is shorter)', () => {
    // [3, 7, 8] → first half: [3], second half: [7, 8] avg=7.5 → improving
    expect(sentimentTrend([3, 7, 8])).toBe('improving')
  })
})

// ── computePricePerformance ─────────────────────────────────────────────────

describe('computePricePerformance', () => {
  const makeRecord = (date: string, close: number, high: number, low: number): PriceRecord => ({
    date, open: close, high, low, close, volume: 1000,
  })

  it('returns null for empty records', () => {
    expect(computePricePerformance([], '00662.TW')).toBeNull()
  })

  it('computes correct startClose and endClose', () => {
    const records = [
      makeRecord('2026-01-01', 100, 110, 90),
      makeRecord('2026-01-02', 120, 130, 115),
    ]
    const result = computePricePerformance(records, '00662.TW')
    expect(result?.startClose).toBe(100)
    expect(result?.endClose).toBe(120)
  })

  it('computes changePct correctly', () => {
    const records = [
      makeRecord('2026-01-01', 100, 110, 90),
      makeRecord('2026-01-02', 110, 115, 100),
    ]
    const result = computePricePerformance(records, 'QQQ')
    expect(result?.changePct).toBeCloseTo(10)
  })

  it('computes period high and low across all records', () => {
    const records = [
      makeRecord('2026-01-01', 100, 120, 80),
      makeRecord('2026-01-02', 110, 130, 90),
      makeRecord('2026-01-03', 105, 115, 95),
    ]
    const result = computePricePerformance(records, '^TWII')
    expect(result?.high).toBe(130)
    expect(result?.low).toBe(80)
  })

  it('returns correct ticker', () => {
    const records = [makeRecord('2026-01-01', 100, 110, 90)]
    const result = computePricePerformance(records, 'QQQ')
    expect(result?.ticker).toBe('QQQ')
  })

  it('handles single record (startClose equals endClose, changePct is 0)', () => {
    const records = [makeRecord('2026-01-01', 100, 110, 90)]
    const result = computePricePerformance(records, 'QQQ')
    expect(result?.changePct).toBe(0)
  })
})

// ── aggregateDailyReports ───────────────────────────────────────────────────

describe('aggregateDailyReports', () => {
  const makeReport = (score: number, risks: string[]): AnalysisReport => ({
    id: 'test-id',
    date: '2026-01-01',
    sentimentScore: score,
    signal: 'hold',
    summary: 'test',
    risks,
    topHeadlines: [],
    newsCount: 1,
    createdAt: '2026-01-01T00:00:00Z',
  })

  it('returns zero avg and empty risks for empty array', () => {
    const result = aggregateDailyReports([])
    expect(result.avgSentimentScore).toBe(0)
    expect(result.topRisks).toEqual([])
  })

  it('computes average sentiment score', () => {
    const reports = [makeReport(4, []), makeReport(6, []), makeReport(8, [])]
    const result = aggregateDailyReports(reports)
    expect(result.avgSentimentScore).toBeCloseTo(6)
  })

  it('deduplicates risks', () => {
    const reports = [
      makeReport(5, ['利率風險', 'AI泡沫']),
      makeReport(5, ['利率風險', '匯率風險']),
    ]
    const result = aggregateDailyReports(reports)
    expect(result.topRisks).toContain('利率風險')
    expect(result.topRisks.filter(r => r === '利率風險')).toHaveLength(1)
  })

  it('caps topRisks at 5 entries', () => {
    const reports = [
      makeReport(5, ['r1', 'r2', 'r3']),
      makeReport(5, ['r4', 'r5', 'r6', 'r7']),
    ]
    const result = aggregateDailyReports(reports)
    expect(result.topRisks.length).toBeLessThanOrEqual(5)
  })

  it('rounds avgSentimentScore to 2 decimal places', () => {
    const reports = [makeReport(7, []), makeReport(8, []), makeReport(6, [])]
    const result = aggregateDailyReports(reports)
    const decimals = (result.avgSentimentScore.toString().split('.')[1] ?? '').length
    expect(decimals).toBeLessThanOrEqual(2)
  })
})
