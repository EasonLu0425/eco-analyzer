import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '@/lib/db'
import { getSeries, upsertSeries } from '@/lib/macro-store'

describe('macro-store', () => {
  let db: Database.Database

  beforeEach(() => {
    db = new Database(':memory:')
    runMigrations(db)
  })

  it('returns an empty array for a series that was never written', () => {
    expect(getSeries('inst_foreign_net', db)).toEqual([])
  })

  it('stores points and returns them sorted by date', () => {
    upsertSeries('inst_foreign_net', [
      { date: '2026-01-03', value: 3 },
      { date: '2026-01-01', value: 1 },
      { date: '2026-01-02', value: 2 },
    ], db)
    expect(getSeries('inst_foreign_net', db).map(p => p.date)).toEqual(['2026-01-01', '2026-01-02', '2026-01-03'])
  })

  it('overwrites an existing point for the same series and date', () => {
    upsertSeries('margin_balance', [{ date: '2026-01-01', value: 1 }], db)
    upsertSeries('margin_balance', [{ date: '2026-01-01', value: 9 }], db)
    expect(getSeries('margin_balance', db)).toEqual([{ date: '2026-01-01', value: 9 }])
  })

  it('keeps different series isolated', () => {
    upsertSeries('a', [{ date: '2026-01-01', value: 1 }], db)
    upsertSeries('b', [{ date: '2026-01-01', value: 2 }], db)
    expect(getSeries('a', db)).toEqual([{ date: '2026-01-01', value: 1 }])
    expect(getSeries('b', db)).toEqual([{ date: '2026-01-01', value: 2 }])
  })

  it('accepts an empty batch without error', () => {
    expect(() => upsertSeries('a', [], db)).not.toThrow()
  })
})
