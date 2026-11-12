import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '@/lib/db'
import {
  WATCH_KEYS, getLatestWatchSignals, parseWatchSignals, revenueSignal, saveWatchSignals,
} from '@/lib/watch-signals'
import { daysSince, isStale } from '@/lib/watch-keys'

const sig = (key: string, status: string, note = 'x', source = '某則新聞標題') => ({ key, status, note, source })

describe('revenueSignal', () => {
  // stored unit is a ratio: 0.30 = +30% YoY
  const pts = (...v: number[]) => v.map((value, i) => ({ date: `2026-0${i + 1}-10`, value: value / 100 }))

  it('returns null with fewer than two observations', () => {
    expect(revenueSignal([])).toBeNull()
    expect(revenueSignal(pts(40))).toBeNull()
  })

  it('reports acceleration in YoY growth as improving', () => {
    const s = revenueSignal(pts(30, 36))!
    expect(s.status).toBe('improving')
    expect(s.latest).toBeCloseTo(36, 6)
    expect(s.change).toBeCloseTo(6, 6)
    expect(s.asOf).toBe('2026-02-10')
  })

  it('reports deceleration in YoY growth as weakening', () => {
    expect(revenueSignal(pts(45, 38))!.status).toBe('weakening')
  })

  it('classifies a change exactly at the band edge as a change despite float error', () => {
    expect(revenueSignal([{ date: '2026-01-10', value: 0.3 }, { date: '2026-02-10', value: 0.33 }])!.status).toBe('improving')
    expect(revenueSignal([{ date: '2026-01-10', value: 0.33 }, { date: '2026-02-10', value: 0.3 }])!.status).toBe('weakening')
  })

  it('treats a small change as steady', () => {
    expect(revenueSignal(pts(40, 41.5))!.status).toBe('steady')
  })

  it('uses only the two most recent observations, regardless of input order', () => {
    const shuffled = [{ date: '2026-03-10', value: 0.5 }, { date: '2026-01-10', value: 0.1 }, { date: '2026-02-10', value: 0.4 }]
    const s = revenueSignal(shuffled)!
    expect(s.latest).toBeCloseTo(50, 6)
    expect(s.change).toBeCloseTo(10, 6)
  })
})

describe('parseWatchSignals', () => {
  it('accepts known keys and statuses', () => {
    const out = parseWatchSignals([{ key: 'cowos-capacity', status: 'improving', note: '台積電擴 CoWoS 月產能', source: 's' }])
    expect(out).toEqual([{ key: 'cowos-capacity', status: 'improving', note: '台積電擴 CoWoS 月產能', source: 's' }])
  })

  it('rejects unknown keys, unknown statuses, and no-news placeholders', () => {
    expect(() => parseWatchSignals([{ key: 'nope', status: 'steady', note: 'x', source: 's' }])).toThrow(/key/)
    expect(() => parseWatchSignals([{ key: 'cowos-capacity', status: 'bullish', note: 'x', source: 's' }])).toThrow(/status/)
    expect(() => parseWatchSignals([{ key: 'cowos-capacity', status: 'no-news', note: 'x', source: 's' }])).toThrow(/status/)
  })

  it('rejects empty or oversized notes and duplicate keys', () => {
    expect(() => parseWatchSignals([{ key: 'power-supply', status: 'steady', note: '', source: 's' }])).toThrow(/note/)
    expect(() => parseWatchSignals([{ key: 'power-supply', status: 'steady', note: 'x'.repeat(201), source: 's' }])).toThrow(/note/)
    expect(() => parseWatchSignals([
      { key: 'power-supply', status: 'steady', note: 'a', source: 's' }, { key: 'power-supply', status: 'weakening', note: 'b', source: 's' },
    ])).toThrow(/duplicate/)
  })

  it('requires a source headline that is not empty and not oversized', () => {
    expect(() => parseWatchSignals([{ key: 'power-supply', status: 'steady', note: 'a' }])).toThrow(/source/)
    expect(() => parseWatchSignals([{ key: 'power-supply', status: 'steady', note: 'a', source: '  ' }])).toThrow(/source/)
    expect(() => parseWatchSignals([{ key: 'power-supply', status: 'steady', note: 'a', source: 'x'.repeat(201) }])).toThrow(/source/)
  })

  it('rejects non-array and non-object input', () => {
    expect(() => parseWatchSignals('x')).toThrow()
    expect(() => parseWatchSignals([null])).toThrow()
  })
})

describe('watch signal storage', () => {
  let db: Database.Database
  beforeEach(() => {
    db = new Database(':memory:')
    runMigrations(db)
  })

  it('returns nothing before any signal was saved', () => {
    expect(getLatestWatchSignals(db)).toEqual([])
  })

  it('saves signals and returns the latest per key', () => {
    saveWatchSignals('2026-11-10', [{ key: 'power-supply', status: 'weakening', note: '夜間備轉率偏低', source: 's' }], db)
    saveWatchSignals('2026-11-12', [
      { key: 'power-supply', status: 'steady', note: '電價審議延至 12 月', source: 's' },
      { key: 'cowos-capacity', status: 'improving', note: '擴產核准', source: 's' },
    ], db)
    const latest = getLatestWatchSignals(db)
    expect(latest.find(s => s.key === 'power-supply')).toMatchObject({ date: '2026-11-12', status: 'steady' })
    expect(latest.find(s => s.key === 'cowos-capacity')).toMatchObject({ date: '2026-11-12', status: 'improving' })
    expect(latest).toHaveLength(2)
  })

  it('keeps a key that was not mentioned on the latest day at its last known state', () => {
    saveWatchSignals('2026-11-10', [{ key: 'hyperscaler-capex', status: 'improving', note: '上調資本支出', source: 's' }], db)
    saveWatchSignals('2026-11-12', [{ key: 'power-supply', status: 'steady', note: 'x', source: 's' }], db)
    expect(getLatestWatchSignals(db).find(s => s.key === 'hyperscaler-capex')?.date).toBe('2026-11-10')
  })

  it('overwrites the same key and date (later session replaces earlier)', () => {
    saveWatchSignals('2026-11-12', [{ key: 'power-supply', status: 'steady', note: '早盤', source: 's' }], db)
    saveWatchSignals('2026-11-12', [{ key: 'power-supply', status: 'weakening', note: '收盤', source: 's' }], db)
    expect(getLatestWatchSignals(db)).toEqual([{ key: 'power-supply', date: '2026-11-12', status: 'weakening', note: '收盤', source: 's' }])
  })

  it('does not write anything when one signal in the batch is invalid', () => {
    expect(() => saveWatchSignals('2026-11-12', [
      { key: 'power-supply', status: 'steady', note: 'ok', source: 's' },
      { key: 'bogus', status: 'steady', note: 'bad', source: 's' } as never,
    ], db)).toThrow()
    expect(getLatestWatchSignals(db)).toEqual([])
  })

  it('stores the source headline with each signal', () => {
    saveWatchSignals('2026-11-12', [{ key: 'cowos-capacity', status: 'improving', note: '擴產', source: '台積電獲准擴建先進封裝' }], db)
    expect(getLatestWatchSignals(db)[0]).toMatchObject({ source: '台積電獲准擴建先進封裝' })
  })

  it('rejects a malformed date so lexicographic "latest" stays correct', () => {
    const one = [{ key: 'power-supply', status: 'steady', note: 'a', source: 's' }] as never
    expect(() => saveWatchSignals('2026-1-5', one, db)).toThrow(/date/)
    expect(() => saveWatchSignals('2026-11-12T08:00', one, db)).toThrow(/date/)
    expect(getLatestWatchSignals(db)).toEqual([])
  })

  it('exposes the three qualitative keys', () => {
    expect([...WATCH_KEYS].sort()).toEqual(['cowos-capacity', 'hyperscaler-capex', 'power-supply'])
  })
})

describe('staleness helpers', () => {
  it('counts whole days between two dates', () => {
    expect(daysSince('2026-11-02', '2026-11-12')).toBe(10)
    expect(daysSince('2026-11-12', '2026-11-12')).toBe(0)
    expect(daysSince('2026-10-31', '2026-11-02')).toBe(2)
  })

  it('treats signals older than 30 days as stale', () => {
    expect(isStale('2026-10-13', '2026-11-12')).toBe(false) // 30 days
    expect(isStale('2026-10-12', '2026-11-12')).toBe(true)  // 31 days
  })
})
