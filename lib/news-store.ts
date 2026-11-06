import type Database from 'better-sqlite3'
import type { NewsItem, ReportSession, StoredNewsItem } from '@/types'
import { getDb } from './db'

/**
 * Insert news items, deduplicated by URL. The first session that saw an item keeps ownership,
 * so `getNewsForDate(date, session)` returns what was *new* in that session.
 * Returns the number of newly inserted rows.
 */
export function saveNewsItems(
  items: NewsItem[],
  collectedDate: string,
  session: ReportSession,
  db?: Database.Database,
): number {
  if (items.length === 0) return 0
  const d = db ?? getDb()
  const collectedAt = new Date().toISOString()
  const insert = d.prepare(`
    INSERT OR IGNORE INTO news_items
      (url, title, description, published_at, source, collected_date, session, collected_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)

  return d.transaction((rows: NewsItem[]) => {
    let inserted = 0
    for (const n of rows) {
      const result = insert.run(
        n.url, n.title, n.description, n.publishedAt, n.source, collectedDate, session, collectedAt,
      )
      inserted += result.changes
    }
    return inserted
  })(items)
}

/** Union of two news lists by URL (first occurrence wins), newest first. Inputs are not mutated. */
export function mergeNewsItems(existing: NewsItem[], incoming: NewsItem[]): NewsItem[] {
  const byUrl = new Map<string, NewsItem>()
  for (const n of [...existing, ...incoming]) {
    if (!byUrl.has(n.url)) byUrl.set(n.url, n)
  }
  return [...byUrl.values()].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
}

export function getNewsForDate(
  collectedDate: string,
  session?: ReportSession,
  db?: Database.Database,
): StoredNewsItem[] {
  const d = db ?? getDb()
  const rows = session
    ? d.prepare(
        'SELECT * FROM news_items WHERE collected_date = ? AND session = ? ORDER BY published_at DESC',
      ).all(collectedDate, session)
    : d.prepare(
        'SELECT * FROM news_items WHERE collected_date = ? ORDER BY published_at DESC',
      ).all(collectedDate)

  return (rows as Record<string, string>[]).map(r => ({
    url: r.url,
    title: r.title,
    description: r.description,
    publishedAt: r.published_at,
    source: r.source,
    collectedDate: r.collected_date,
    session: r.session as ReportSession,
    collectedAt: r.collected_at,
  }))
}
