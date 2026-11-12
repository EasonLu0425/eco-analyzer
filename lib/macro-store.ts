import type Database from 'better-sqlite3'
import { getDb } from './db'

/** One observation of a named series. `date` is the first day the value was publicly known. */
export interface SeriesPoint {
  date: string // YYYY-MM-DD
  value: number
}

export function upsertSeries(series: string, points: readonly SeriesPoint[], db?: Database.Database): void {
  if (points.length === 0) return
  const d = db ?? getDb()
  const stmt = d.prepare(
    `INSERT INTO macro_series (series, date, value) VALUES (?, ?, ?)
     ON CONFLICT(series, date) DO UPDATE SET value = excluded.value`,
  )
  d.transaction((rows: readonly SeriesPoint[]) => {
    for (const p of rows) stmt.run(series, p.date, p.value)
  })(points)
}

export function getSeries(series: string, db?: Database.Database): SeriesPoint[] {
  const d = db ?? getDb()
  return d
    .prepare('SELECT date, value FROM macro_series WHERE series = ? ORDER BY date ASC')
    .all(series) as SeriesPoint[]
}
