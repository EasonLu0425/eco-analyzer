import { describe, it, expect } from 'vitest'
import { structuredFeatures, trailingZ, type MacroData } from '@/lib/structured-features'
import type { SeriesPoint } from '@/lib/macro-store'

/** n consecutive calendar days starting 2025-01-01 with value fn(i). */
function series(n: number, fn: (i: number) => number, start = 0): SeriesPoint[] {
  return Array.from({ length: n }, (_, i) => ({
    date: new Date(Date.UTC(2025, 0, 1 + start + i)).toISOString().slice(0, 10),
    value: fn(i),
  }))
}
const dayAfter = (pts: SeriesPoint[]): string => {
  const d = new Date(`${pts.at(-1)!.date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

function macro(over: Partial<MacroData> = {}): MacroData {
  return { foreignNet: [], margin: [], sox: [], vix: [], tnx: [], usdtwd: [], revYoy: {}, ...over }
}

describe('structuredFeatures — no look-ahead', () => {
  it('ignores points dated on or after the decision day', () => {
    const sox = series(60, i => 100 + i)
    const day = dayAfter(sox)
    const base = structuredFeatures(day, macro({ sox }))
    const withFuture = structuredFeatures(day, macro({
      sox: [...sox, { date: day, value: 1 }, { date: '2099-01-01', value: 1e9 }],
    }))
    expect(withFuture).toEqual(base)
  })

  it('uses data strictly before the day: a point dated the same day is excluded', () => {
    const sox = series(30, i => 100 + i)
    const sameDay = { date: dayAfter(sox), value: 5000 }
    const f = structuredFeatures(sameDay.date, macro({ sox: [...sox, sameDay] }))
    expect(f.soxMom20).toBeCloseTo(129 / 109 - 1, 8)
  })
})

describe('structuredFeatures — values', () => {
  it('soxMom20 is the return over the last 20 observations', () => {
    const sox = series(40, i => 100 * 1.01 ** i)
    expect(structuredFeatures(dayAfter(sox), macro({ sox })).soxMom20).toBeCloseTo(1.01 ** 20 - 1, 8)
  })

  it('tnxChange20 is an absolute change and usdtwdChange20 a relative one', () => {
    const tnx = series(30, i => 4 + i * 0.01)
    const usdtwd = series(30, i => 30 + i * 0.1)
    const f = structuredFeatures(dayAfter(tnx), macro({ tnx, usdtwd }))
    expect(f.tnxChange20).toBeCloseTo(0.2, 8)
    expect(f.usdtwdChange20).toBeCloseTo((32.9 / 30.9) - 1, 8)
  })

  it('marginChange20 compares the latest balance with 20 observations earlier', () => {
    const margin = series(30, i => 1000 + i * 10)
    expect(structuredFeatures(dayAfter(margin), macro({ margin })).marginChange20).toBeCloseTo(1290 / 1090 - 1, 8)
  })

  it('vixPct is the percentile rank of the latest VIX inside the trailing year', () => {
    const vix = series(260, i => (i === 259 ? 1000 : i)) // latest is the highest
    expect(structuredFeatures(dayAfter(vix), macro({ vix })).vixPct).toBeCloseTo(1, 6)
    const low = series(260, i => (i === 259 ? -5 : i)) // latest is the lowest
    expect(structuredFeatures(dayAfter(low), macro({ vix: low })).vixPct).toBeCloseTo(0, 2)
  })

  it('foreignFlowZ is positive after a burst of buying and null for a flat history', () => {
    const quiet = series(300, i => (i % 2 === 0 ? 10 : -10))
    const burst = [...quiet.slice(0, 295), ...series(5, () => 500, 295)]
    expect(structuredFeatures(dayAfter(burst), macro({ foreignNet: burst })).foreignFlowZ).toBeGreaterThan(2)
    const flat = series(300, () => 0)
    expect(structuredFeatures(dayAfter(flat), macro({ foreignNet: flat })).foreignFlowZ).toBeNull()
  })

  it('revMomentum is the median change in YoY over three months across bellwethers', () => {
    // each name: YoY steps 0.10, 0.12, 0.14, 0.20 (latest) -> change = 0.20 - 0.10 = 0.10 (index -4)
    const mk = (bump: number): SeriesPoint[] => [
      { date: '2025-01-10', value: 0.10 + bump }, { date: '2025-02-10', value: 0.12 },
      { date: '2025-03-10', value: 0.14 }, { date: '2025-04-10', value: 0.20 + bump * 3 },
    ]
    const revYoy = { a: mk(0), b: mk(0.01), c: mk(0.02), d: mk(0.03) }
    const f = structuredFeatures('2025-05-01', macro({ revYoy }))
    // changes: 0.10, 0.12, 0.14, 0.16 -> median 0.13
    expect(f.revMomentum).toBeCloseTo(0.13, 8)
  })

  it('revMomentum is null with fewer than four reporting bellwethers', () => {
    const one: SeriesPoint[] = series(6, i => i * 0.01)
    expect(structuredFeatures(dayAfter(one), macro({ revYoy: { a: one, b: one, c: one } })).revMomentum).toBeNull()
  })

  it('returns null features when there is not enough history', () => {
    const f = structuredFeatures('2025-01-05', macro({ sox: series(3, i => i + 1) }))
    expect(f.soxMom20).toBeNull()
    expect(f.vixPct).toBeNull()
  })
})

describe('trailingZ', () => {
  it('standardises each point against the window ending at that point (no future values)', () => {
    const z1 = trailingZ([1, 2, 3, 4, 5, 6], 4)
    const z2 = trailingZ([1, 2, 3, 4, 5, 6, 1000], 4)
    expect(z2.slice(0, 6)).toEqual(z1)
    expect(z1[0]).toBeNull()
    expect(z1[3]).toBeCloseTo((4 - 2.5) / Math.sqrt(1.25), 8)
  })

  it('returns null for any window that contains a missing value', () => {
    const z = trailingZ([null, 1, 2, 3], 3)
    expect(z[2]).toBeNull() // window [null, 1, 2]
    expect(z[3]).toBeCloseTo(1 / Math.sqrt(2 / 3), 8) // window [1, 2, 3]
  })
})
