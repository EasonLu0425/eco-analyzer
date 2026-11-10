import type Database from 'better-sqlite3'
import type { NewsItem, ReportSession } from '@/types'
import { getDb } from './db'

/**
 * Each session only accepts news published AFTER the previous collection run, so windows are
 * contiguous and never overlap: morning = since last close, midday = since morning, close = since midday.
 */

/** Morning with no recorded history never reaches back further than this (covers a weekend). */
const MORNING_FALLBACK_HOURS = 72
/** Wall-clock fallbacks (Asia/Taipei, UTC+8) when the previous run was never recorded. */
const FALLBACK_START_HHMM: Record<'midday' | 'close', string> = { midday: '08:30', close: '11:00' }
/** Tolerance for feeds whose clocks run slightly ahead of ours. */
const FUTURE_SKEW_MS = 5 * 60 * 1000

const RUN_KEY_PREFIX = 'news_run_at:'
const runKey = (date: string, session: ReportSession) => `${RUN_KEY_PREFIX}${date}:${session}`

const SESSION_RANK: Record<ReportSession, number> = { morning: 0, midday: 1, close: 2 }

export function recordNewsRun(
  date: string,
  session: ReportSession,
  at: Date,
  db?: Database.Database,
): void {
  const d = db ?? getDb()
  d.prepare(
    'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  ).run(runKey(date, session), at.toISOString())
}

interface RecordedRun {
  date: string
  session: ReportSession
  at: Date
}

function readRuns(db: Database.Database): RecordedRun[] {
  const rows = db.prepare('SELECT key, value FROM meta WHERE key LIKE ?').all(`${RUN_KEY_PREFIX}%`) as {
    key: string
    value: string
  }[]

  return rows.flatMap(({ key, value }) => {
    const [date, session] = key.slice(RUN_KEY_PREFIX.length).split(':')
    const at = new Date(value)
    if (!date || !(session in SESSION_RANK) || Number.isNaN(at.getTime())) return []
    return [{ date, session: session as ReportSession, at }]
  })
}

const latest = (runs: RecordedRun[]): Date | null =>
  runs.reduce<Date | null>((best, r) => (best === null || r.at > best ? r.at : best), null)

/** Start of the freshness window for `session` on `today` (YYYY-MM-DD, Asia/Taipei). Exclusive. */
export function getFreshnessCutoff(
  session: ReportSession,
  today: string,
  now: Date,
  db?: Database.Database,
): Date {
  const runs = readRuns(db ?? getDb())

  if (session === 'morning') {
    return latest(runs.filter(r => r.date < today)) ?? new Date(now.getTime() - MORNING_FALLBACK_HOURS * 3600_000)
  }

  const earlierToday = runs.filter(r => r.date === today && SESSION_RANK[r.session] < SESSION_RANK[session])
  return latest(earlierToday) ?? new Date(`${today}T${FALLBACK_START_HHMM[session]}:00+08:00`)
}

export interface FreshnessResult {
  fresh: NewsItem[]
  stale: NewsItem[]
}

/** Split items into those published inside (cutoff, now] and the rest (old, future-dated, or unparseable). */
export function filterFreshNews(items: readonly NewsItem[], cutoff: Date, now: Date): FreshnessResult {
  const fresh: NewsItem[] = []
  const stale: NewsItem[] = []
  const latestAllowed = now.getTime() + FUTURE_SKEW_MS

  for (const item of items) {
    const t = new Date(item.publishedAt).getTime()
    const isFresh = !Number.isNaN(t) && t > cutoff.getTime() && t <= latestAllowed
    ;(isFresh ? fresh : stale).push(item)
  }
  return { fresh, stale }
}
