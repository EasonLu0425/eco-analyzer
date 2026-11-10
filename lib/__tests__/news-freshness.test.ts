import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import type { NewsItem } from '@/types'
import { runMigrations } from '@/lib/db'
import {
  filterFreshNews,
  getFreshnessCutoff,
  recordNewsRun,
} from '@/lib/news-freshness'

function makeDb() {
  const db = new Database(':memory:')
  runMigrations(db)
  return db
}

const at = (iso: string) => new Date(iso)
const item = (url: string, publishedAt: string): NewsItem => ({
  title: `t ${url}`,
  description: '',
  url,
  publishedAt,
  source: 's',
})

describe('getFreshnessCutoff', () => {
  let db: Database.Database
  beforeEach(() => {
    db = makeDb()
  })

  it('midday: starts at the morning run time of the same day', () => {
    recordNewsRun('2026-11-10', 'morning', at('2026-11-10T00:30:20.000Z'), db)
    const cutoff = getFreshnessCutoff('midday', '2026-11-10', at('2026-11-10T03:00:00.000Z'), db)
    expect(cutoff.toISOString()).toBe('2026-11-10T00:30:20.000Z')
  })

  it('close: starts at the midday run time, not the morning one', () => {
    recordNewsRun('2026-11-10', 'morning', at('2026-11-10T00:30:00.000Z'), db)
    recordNewsRun('2026-11-10', 'midday', at('2026-11-10T03:00:10.000Z'), db)
    const cutoff = getFreshnessCutoff('close', '2026-11-10', at('2026-11-10T06:30:00.000Z'), db)
    expect(cutoff.toISOString()).toBe('2026-11-10T03:00:10.000Z')
  })

  it('close: falls back to the morning run when midday never ran', () => {
    recordNewsRun('2026-11-10', 'morning', at('2026-11-10T00:30:00.000Z'), db)
    const cutoff = getFreshnessCutoff('close', '2026-11-10', at('2026-11-10T06:30:00.000Z'), db)
    expect(cutoff.toISOString()).toBe('2026-11-10T00:30:00.000Z')
  })

  it('midday without a recorded morning run falls back to 08:30 Taipei of that day', () => {
    const cutoff = getFreshnessCutoff('midday', '2026-11-10', at('2026-11-10T03:00:00.000Z'), db)
    expect(cutoff.toISOString()).toBe('2026-11-10T00:30:00.000Z')
  })

  it('close without any recorded run falls back to 11:00 Taipei of that day', () => {
    const cutoff = getFreshnessCutoff('close', '2026-11-10', at('2026-11-10T06:30:00.000Z'), db)
    expect(cutoff.toISOString()).toBe('2026-11-10T03:00:00.000Z')
  })

  it('morning: starts at the latest run of an earlier day (covers the weekend)', () => {
    recordNewsRun('2026-11-06', 'midday', at('2026-11-06T03:00:00.000Z'), db)
    recordNewsRun('2026-11-06', 'close', at('2026-11-06T06:30:30.000Z'), db)
    const cutoff = getFreshnessCutoff('morning', '2026-11-09', at('2026-11-09T01:12:00.000Z'), db)
    expect(cutoff.toISOString()).toBe('2026-11-06T06:30:30.000Z')
  })

  it('morning ignores runs recorded on the same day', () => {
    recordNewsRun('2026-11-09', 'close', at('2026-11-09T06:30:00.000Z'), db)
    recordNewsRun('2026-11-06', 'close', at('2026-11-06T06:30:30.000Z'), db)
    const cutoff = getFreshnessCutoff('morning', '2026-11-09', at('2026-11-09T01:12:00.000Z'), db)
    expect(cutoff.toISOString()).toBe('2026-11-06T06:30:30.000Z')
  })

  it('morning with no history allows at most 72 hours back', () => {
    const now = at('2026-11-09T01:12:00.000Z')
    const cutoff = getFreshnessCutoff('morning', '2026-11-09', now, db)
    expect(cutoff.toISOString()).toBe('2026-11-06T01:12:00.000Z')
  })

  it('re-recording a run overwrites the previous timestamp', () => {
    recordNewsRun('2026-11-10', 'morning', at('2026-11-10T00:30:00.000Z'), db)
    recordNewsRun('2026-11-10', 'morning', at('2026-11-10T01:00:00.000Z'), db)
    const cutoff = getFreshnessCutoff('midday', '2026-11-10', at('2026-11-10T03:00:00.000Z'), db)
    expect(cutoff.toISOString()).toBe('2026-11-10T01:00:00.000Z')
  })
})

describe('filterFreshNews', () => {
  const cutoff = at('2026-11-10T03:00:00.000Z')
  const now = at('2026-11-10T06:30:00.000Z')

  it('keeps only items published strictly after the cutoff', () => {
    const items = [
      item('old', '2026-11-10T02:59:59.000Z'),
      item('exact', '2026-11-10T03:00:00.000Z'),
      item('new', '2026-11-10T03:00:01.000Z'),
    ]
    const { fresh, stale } = filterFreshNews(items, cutoff, now)
    expect(fresh.map(i => i.url)).toEqual(['new'])
    expect(stale.map(i => i.url)).toEqual(['old', 'exact'])
  })

  it('drops items dated in the future (bad feed timestamps)', () => {
    const { fresh, stale } = filterFreshNews([item('future', '2026-11-10T09:00:00.000Z')], cutoff, now)
    expect(fresh).toHaveLength(0)
    expect(stale).toHaveLength(1)
  })

  it('tolerates a few minutes of clock skew', () => {
    const { fresh } = filterFreshNews([item('skew', '2026-11-10T06:33:00.000Z')], cutoff, now)
    expect(fresh).toHaveLength(1)
  })

  it('drops items with an unparseable date', () => {
    const { fresh, stale } = filterFreshNews([item('bad', 'not-a-date')], cutoff, now)
    expect(fresh).toHaveLength(0)
    expect(stale).toHaveLength(1)
  })

  it('does not mutate the input array', () => {
    const items = [item('a', '2026-11-10T04:00:00.000Z')]
    const copy = [...items]
    filterFreshNews(items, cutoff, now)
    expect(items).toEqual(copy)
  })
})
