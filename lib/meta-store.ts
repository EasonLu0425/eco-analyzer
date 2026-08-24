import type Database from 'better-sqlite3'
import { getDb } from './db'

export function getMeta(key: string, db?: Database.Database): string | null {
  const d = db ?? getDb()
  const row = d.prepare('SELECT value FROM meta WHERE key = ?').get(key) as { value: string } | undefined
  return row?.value ?? null
}

export function setMeta(key: string, value: string, db?: Database.Database): void {
  const d = db ?? getDb()
  d.prepare(
    'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  ).run(key, value)
}
