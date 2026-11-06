import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import type { NewsItem } from '@/types'
import { runMigrations } from '@/lib/db'
import { getNewsForDate, mergeNewsItems, saveNewsItems } from '@/lib/news-store'

function makeDb() {
  const db = new Database(':memory:')
  runMigrations(db)
  return db
}

const item = (url: string, title = `title ${url}`): NewsItem => ({
  title,
  description: `desc ${url}`,
  url,
  publishedAt: '2026-11-06T01:00:00.000Z',
  source: 'cnyes',
})

describe('news-store', () => {
  let db: Database.Database

  beforeEach(() => {
    db = makeDb()
  })

  it('inserts items and reports how many were new', () => {
    const inserted = saveNewsItems([item('a'), item('b')], '2026-11-06', 'morning', db)
    expect(inserted).toBe(2)
    expect(getNewsForDate('2026-11-06', undefined, db)).toHaveLength(2)
  })

  it('deduplicates by url and keeps the first-seen session', () => {
    saveNewsItems([item('a')], '2026-11-06', 'morning', db)
    const inserted = saveNewsItems([item('a', 'changed'), item('b')], '2026-11-06', 'midday', db)

    expect(inserted).toBe(1)
    const all = getNewsForDate('2026-11-06', undefined, db)
    expect(all).toHaveLength(2)
    expect(all.find(n => n.url === 'a')).toMatchObject({ session: 'morning', title: 'title a' })
  })

  it('filters by first-seen session', () => {
    saveNewsItems([item('a')], '2026-11-06', 'morning', db)
    saveNewsItems([item('b'), item('c')], '2026-11-06', 'midday', db)

    const midday = getNewsForDate('2026-11-06', 'midday', db)
    expect(midday.map(n => n.url).sort()).toEqual(['b', 'c'])
  })

  it('isolates different dates', () => {
    saveNewsItems([item('a')], '2026-11-05', 'close', db)
    saveNewsItems([item('b')], '2026-11-06', 'morning', db)
    expect(getNewsForDate('2026-11-06', undefined, db).map(n => n.url)).toEqual(['b'])
  })

  it('returns 0 and stores nothing for an empty list', () => {
    expect(saveNewsItems([], '2026-11-06', 'morning', db)).toBe(0)
    expect(getNewsForDate('2026-11-06', undefined, db)).toEqual([])
  })
})

describe('mergeNewsItems', () => {
  it('keeps existing items, adds new ones, and dedupes by url', () => {
    const merged = mergeNewsItems([item('a'), item('b')], [item('b', 'newer title'), item('c')])
    expect(merged.map(n => n.url).sort()).toEqual(['a', 'b', 'c'])
    expect(merged.find(n => n.url === 'b')?.title).toBe('title b')
  })

  it('sorts by publishedAt descending', () => {
    const older = { ...item('old'), publishedAt: '2026-11-06T00:00:00.000Z' }
    const newer = { ...item('new'), publishedAt: '2026-11-06T05:00:00.000Z' }
    expect(mergeNewsItems([older], [newer]).map(n => n.url)).toEqual(['new', 'old'])
  })

  it('does not mutate its inputs', () => {
    const existing = [item('a')]
    const incoming = [item('b')]
    mergeNewsItems(existing, incoming)
    expect(existing).toHaveLength(1)
    expect(incoming).toHaveLength(1)
  })

  it('handles both lists empty', () => {
    expect(mergeNewsItems([], [])).toEqual([])
  })
})
