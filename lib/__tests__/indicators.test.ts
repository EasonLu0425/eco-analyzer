import { describe, it, expect } from 'vitest'
import { computeRSI, computeMACD, computeBollinger, computeIndicators } from '@/lib/indicators'

function makeCloses(n: number, start = 100, step = 1): number[] {
  return Array.from({ length: n }, (_, i) => start + i * step)
}

describe('computeRSI', () => {
  it('returns all null when fewer than 15 values', () => {
    const result = computeRSI(makeCloses(14))
    expect(result.every(v => v === null)).toBe(true)
  })

  it('produces non-null at index 14 with 15 values', () => {
    const result = computeRSI(makeCloses(15))
    expect(result[14]).not.toBeNull()
    expect(result[0]).toBeNull()
  })

  it('returns 100 for a purely rising series', () => {
    const result = computeRSI(makeCloses(20))
    expect(result[result.length - 1]).toBeCloseTo(100, 0)
  })

  it('returns 0 for a purely falling series', () => {
    const result = computeRSI(makeCloses(20, 100, -1))
    expect(result[result.length - 1]).toBeCloseTo(0, 0)
  })

  it('keeps all values in 0–100 range', () => {
    const closes = [100, 102, 101, 103, 100, 98, 99, 101, 103, 104, 102, 101, 103, 105, 104, 106]
    computeRSI(closes).forEach(v => {
      if (v !== null) {
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(100)
      }
    })
  })
})

describe('computeMACD', () => {
  it('returns all null with fewer than 26 values', () => {
    const { line } = computeMACD(makeCloses(25))
    expect(line.every(v => v === null)).toBe(true)
  })

  it('produces non-null line, signal and histogram with 40+ values', () => {
    const { line, signalLine, histogram } = computeMACD(makeCloses(40))
    expect(line.some(v => v !== null)).toBe(true)
    expect(signalLine.some(v => v !== null)).toBe(true)
    expect(histogram.some(v => v !== null)).toBe(true)
  })

  it('histogram equals line minus signal at every point', () => {
    const { line, signalLine, histogram } = computeMACD(makeCloses(50, 100, 0.5))
    for (let i = 0; i < 50; i++) {
      if (line[i] !== null && signalLine[i] !== null && histogram[i] !== null) {
        expect(histogram[i]).toBeCloseTo((line[i] as number) - (signalLine[i] as number), 8)
      }
    }
  })
})

describe('computeBollinger', () => {
  it('returns all null with fewer than 20 values', () => {
    const { upper } = computeBollinger(makeCloses(19))
    expect(upper.every(v => v === null)).toBe(true)
  })

  it('upper > middle > lower for trending series', () => {
    const { upper, middle, lower } = computeBollinger(makeCloses(30))
    for (let i = 19; i < 30; i++) {
      expect(upper[i]!).toBeGreaterThan(middle[i]!)
      expect(middle[i]!).toBeGreaterThan(lower[i]!)
    }
  })

  it('bbPosition is in 0–100 range', () => {
    computeBollinger(makeCloses(30)).position.forEach(p => {
      if (p !== null) {
        expect(p).toBeGreaterThanOrEqual(0)
        expect(p).toBeLessThanOrEqual(100)
      }
    })
  })
})

describe('computeIndicators', () => {
  it('returns one entry per record with correct ticker and date', () => {
    const records = makeCloses(40).map((c, i) => ({
      date: `2026-01-${String(i + 1).padStart(2, '0')}`,
      open: c, high: c + 1, low: c - 1, close: c, volume: 1000,
    }))
    const result = computeIndicators(records, '0050.TW')
    expect(result).toHaveLength(40)
    expect(result[0].ticker).toBe('0050.TW')
    expect(result[0].date).toBe('2026-01-01')
  })
})
