/** Pure constants and date helpers for watch signals; safe to import from client or server code (no DB). */

export const WATCH_KEYS = ['hyperscaler-capex', 'cowos-capacity', 'power-supply'] as const
export type WatchKey = (typeof WATCH_KEYS)[number]

export const WATCH_STATUSES = ['improving', 'steady', 'weakening'] as const
export type WatchStatus = (typeof WATCH_STATUSES)[number]

/** A carried-forward signal older than this many days is shown as stale. */
export const STALE_AFTER_DAYS = 30

const MS_PER_DAY = 86_400_000
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** A real calendar date: round-trips through Date, so 2026-02-31 (which Date.parse rolls over) is rejected. */
export const isIsoDate = (v: string): boolean => {
  if (!DATE_RE.test(v)) return false
  const ms = Date.parse(`${v}T00:00:00Z`)
  return !Number.isNaN(ms) && new Date(ms).toISOString().slice(0, 10) === v
}

/** Whole days from `from` to `to` (both YYYY-MM-DD). */
export function daysSince(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / MS_PER_DAY)
}

export const isStale = (from: string, to: string): boolean => daysSince(from, to) > STALE_AFTER_DAYS
