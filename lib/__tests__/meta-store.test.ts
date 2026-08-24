import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '@/lib/db'
import { getMeta, setMeta } from '@/lib/meta-store'

function makeDb() {
  const db = new Database(':memory:')
  runMigrations(db)
  return db
}

describe('meta-store', () => {
  let db: Database.Database

  beforeEach(() => {
    db = makeDb()
  })

  it('returns null for a key that was never set', () => {
    expect(getMeta('prices_fetched_at', db)).toBeNull()
  })

  it('returns the value after set', () => {
    setMeta('prices_fetched_at', '2026-07-31T08:15:00.000Z', db)
    expect(getMeta('prices_fetched_at', db)).toBe('2026-07-31T08:15:00.000Z')
  })

  it('overwrites the previous value on repeated set', () => {
    setMeta('prices_fetched_at', '2026-07-30T08:00:00.000Z', db)
    setMeta('prices_fetched_at', '2026-07-31T08:15:00.000Z', db)
    expect(getMeta('prices_fetched_at', db)).toBe('2026-07-31T08:15:00.000Z')
  })
})
