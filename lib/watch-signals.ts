/**
 * Long-horizon watch signals for the AI-capex thesis behind Taiwan tech ETFs.
 * Quantitative: TSMC monthly-revenue YoY acceleration, computed from macro_series (no LLM).
 * Qualitative: hyperscaler capex guidance, CoWoS capacity, power supply, judged by the analysis
 * command from that day's news and stored here. Nothing is stored when the news was silent.
 */
import type Database from 'better-sqlite3'
import { getDb } from './db'
import type { SeriesPoint } from './macro-store'
import { WATCH_KEYS, WATCH_STATUSES, isIsoDate, type WatchKey, type WatchStatus } from './watch-keys'

export { WATCH_KEYS, WATCH_STATUSES, type WatchKey, type WatchStatus }

export interface WatchSignalInput {
  key: WatchKey
  status: WatchStatus
  note: string
  source: string   // headline the signal is based on, so it can be audited against the day's news
}

export interface StoredWatchSignal extends WatchSignalInput {
  date: string
}

const MAX_NOTE_LENGTH = 200
const MAX_SOURCE_LENGTH = 200
/** YoY growth must move by at least this many percentage points to count as a change. */
const REVENUE_STEADY_BAND = 3

export interface RevenueSignal {
  status: WatchStatus
  latest: number      // latest monthly revenue YoY, %
  change: number      // latest minus previous, percentage points
  asOf: string        // date the latest figure became public
}

/** `yoy` is the stored ratio series (0.5 = +50% YoY); the result is expressed in percent. */
export function revenueSignal(yoy: readonly SeriesPoint[]): RevenueSignal | null {
  if (yoy.length < 2) return null
  const [prev, last] = [...yoy].sort((a, b) => a.date.localeCompare(b.date)).slice(-2)
  const change = Number(((last.value - prev.value) * 100).toFixed(6)) // strip float noise at the band edge
  const status: WatchStatus = change >= REVENUE_STEADY_BAND ? 'improving' : change <= -REVENUE_STEADY_BAND ? 'weakening' : 'steady'
  return { status, latest: last.value * 100, change, asOf: last.date }
}

const isKey = (v: unknown): v is WatchKey => (WATCH_KEYS as readonly unknown[]).includes(v)
const isStatus = (v: unknown): v is WatchStatus => (WATCH_STATUSES as readonly unknown[]).includes(v)

/** Validate untrusted (LLM-produced) signals; throws with a message naming the offending field. */
export function parseWatchSignals(input: unknown): WatchSignalInput[] {
  if (!Array.isArray(input)) throw new Error('watch signals must be an array')
  const seen = new Set<string>()
  return input.map((raw: unknown) => {
    if (typeof raw !== 'object' || raw === null) throw new Error('watch signal must be an object')
    const { key, status, note, source } = raw as Record<string, unknown>
    if (!isKey(key)) throw new Error(`invalid key: ${String(key)}`)
    if (!isStatus(status)) throw new Error(`invalid status: ${String(status)}`)
    if (typeof note !== 'string' || note.trim().length === 0 || note.length > MAX_NOTE_LENGTH) {
      throw new Error(`invalid note for ${key}: need 1-${MAX_NOTE_LENGTH} characters`)
    }
    if (typeof source !== 'string' || source.trim().length === 0 || source.length > MAX_SOURCE_LENGTH) {
      throw new Error(`invalid source for ${key}: need 1-${MAX_SOURCE_LENGTH} characters`)
    }
    if (seen.has(key)) throw new Error(`duplicate key: ${key}`)
    seen.add(key)
    return { key, status, note: note.trim(), source: source.trim() }
  })
}

export function saveWatchSignals(date: string, signals: readonly WatchSignalInput[], db?: Database.Database): void {
  if (!isIsoDate(date)) throw new Error(`invalid date: ${date}`)
  const valid = parseWatchSignals(signals)
  if (valid.length === 0) return
  const d = db ?? getDb()
  const stmt = d.prepare(
    `INSERT INTO watch_signals (date, key, status, note, source) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(date, key) DO UPDATE SET status = excluded.status, note = excluded.note, source = excluded.source`,
  )
  d.transaction((rows: readonly WatchSignalInput[]) => {
    for (const s of rows) stmt.run(date, s.key, s.status, s.note, s.source)
  })(valid)
}

/** Most recent stored signal for each key (a key the news did not mention keeps its last known state). */
export function getLatestWatchSignals(db?: Database.Database): StoredWatchSignal[] {
  const d = db ?? getDb()
  return d.prepare(
    `SELECT w.date, w.key, w.status, w.note, w.source FROM watch_signals w
     JOIN (SELECT key, MAX(date) AS date FROM watch_signals GROUP BY key) m
       ON m.key = w.key AND m.date = w.date
     ORDER BY w.key`,
  ).all() as StoredWatchSignal[]
}
