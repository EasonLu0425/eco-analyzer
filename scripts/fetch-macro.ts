/**
 * Collect the structured, point-in-time inputs used by the fundamentals/flow study:
 *  - Yahoo daily bars for cross-market factors (stored in `prices`, same table as the ETFs)
 *  - FinMind market-wide institutional net buy + margin balance (stored in `macro_series`)
 *  - FinMind monthly revenue YoY of index bellwethers (stored in `macro_series`, dated when knowable)
 *
 * Idempotent and incremental: re-running only refetches the tail. FinMind's anonymous tier is
 * rate limited; set FINMIND_TOKEN to raise the limit.
 *
 * Usage: tsx scripts/fetch-macro.ts [--years=10]
 */
import { getDb } from '../lib/db'
import { parseInstitutional, parseMarginBalance, parseRevenueYoy, type InstitutionalRow, type MarginRow, type RevenueRow } from '../lib/finmind'
import { BELLWETHERS, MACRO_TICKERS } from '../lib/macro-config'
import { getSeries, upsertSeries } from '../lib/macro-store'
import { fetchPriceData } from './prices/fetcher'

const FINMIND_URL = 'https://api.finmindtrade.com/api/v4/data'
const REQUEST_GAP_MS = 1500
const OVERLAP_DAYS = 7

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const iso = (d: Date) => d.toISOString().slice(0, 10)

async function finmind<T>(dataset: string, params: Record<string, string>, attempt = 1): Promise<T[]> {
  const qs = new URLSearchParams({ dataset, ...params })
  const headers: Record<string, string> = process.env.FINMIND_TOKEN ? { Authorization: `Bearer ${process.env.FINMIND_TOKEN}` } : {}
  const res = await fetch(`${FINMIND_URL}?${qs}`, { headers })
  const body = (await res.json().catch(() => null)) as { status?: number; msg?: string; data?: T[] } | null
  if (!res.ok || !body || body.status !== 200 || !Array.isArray(body.data)) {
    if (attempt < 4) {
      await sleep(REQUEST_GAP_MS * attempt * 4)
      return finmind<T>(dataset, params, attempt + 1)
    }
    throw new Error(`FinMind ${dataset} failed: HTTP ${res.status} ${body?.msg ?? ''}`)
  }
  await sleep(REQUEST_GAP_MS)
  return body.data
}

function startFor(series: string, fallback: string): string {
  const last = getSeries(series).at(-1)?.date
  if (!last) return fallback
  const d = new Date(`${last}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - OVERLAP_DAYS)
  return iso(d)
}

/** Split [start, end] into calendar-year chunks to keep each FinMind response modest. */
function yearChunks(start: string, end: string): Array<[string, string]> {
  const out: Array<[string, string]> = []
  for (let y = Number(start.slice(0, 4)); y <= Number(end.slice(0, 4)); y++) {
    const s = y === Number(start.slice(0, 4)) ? start : `${y}-01-01`
    const e = y === Number(end.slice(0, 4)) ? end : `${y}-12-31`
    out.push([s, e])
  }
  return out
}

async function syncYahoo(years: number): Promise<void> {
  const db = getDb()
  const insert = db.prepare('INSERT OR REPLACE INTO prices (ticker, date, open, high, low, close, volume) VALUES (?, ?, ?, ?, ?, ?, ?)')
  const now = new Date()
  for (const ticker of MACRO_TICKERS) {
    const last = (db.prepare('SELECT MAX(date) AS d FROM prices WHERE ticker = ?').get(ticker) as { d: string | null }).d
    const from = last ? new Date(`${last}T00:00:00Z`) : new Date(Date.UTC(now.getUTCFullYear() - years, now.getUTCMonth(), now.getUTCDate()))
    const rows = await fetchPriceData(ticker, from, now)
    db.transaction(() => { for (const r of rows) insert.run(ticker, r.date, r.open, r.high, r.low, r.close, r.volume) })()
    process.stdout.write(`[macro] ${ticker}: +${rows.length} bars\n`)
  }
}

async function syncFlows(startDefault: string): Promise<void> {
  const end = iso(new Date())
  const inst = parseInstitutional(await collect<InstitutionalRow>('TaiwanStockTotalInstitutionalInvestors', startFor('inst_foreign_net', startDefault), end))
  for (const [name, pts] of Object.entries(inst)) upsertSeries(name, pts)
  process.stdout.write(`[macro] institutional: ${inst.inst_foreign_net.length} days\n`)

  const margin = parseMarginBalance(await collect<MarginRow>('TaiwanStockTotalMarginPurchaseShortSale', startFor('margin_balance', startDefault), end))
  upsertSeries('margin_balance', margin)
  process.stdout.write(`[macro] margin balance: ${margin.length} days\n`)
}

async function collect<T>(dataset: string, start: string, end: string): Promise<T[]> {
  const out: T[] = []
  for (const [s, e] of yearChunks(start, end)) out.push(...(await finmind<T>(dataset, { start_date: s, end_date: e })))
  return out
}

async function syncRevenue(startDefault: string): Promise<void> {
  for (const id of BELLWETHERS) {
    // YoY needs the prior-year month, so always pull from a year before the first month we want.
    const rows = await finmind<RevenueRow>('TaiwanStockMonthRevenue', { data_id: id, start_date: startDefault, end_date: iso(new Date()) })
    const yoy = parseRevenueYoy(rows)
    upsertSeries(`rev_yoy:${id}`, yoy)
    process.stdout.write(`[macro] revenue ${id}: ${yoy.length} months\n`)
  }
}

async function main(): Promise<void> {
  const arg = process.argv.find(a => a.startsWith('--years='))
  const years = arg ? Number(arg.split('=')[1]) : 10
  if (!Number.isInteger(years) || years < 1 || years > 20) throw new Error('--years must be an integer between 1 and 20')

  const startYear = new Date().getUTCFullYear() - years
  await syncYahoo(years)
  await syncFlows(`${startYear}-01-01`)
  await syncRevenue(`${startYear - 1}-01-01`)
  process.stdout.write('[macro] done\n')
}

main().catch(err => {
  process.stderr.write(`[macro] failed: ${(err as Error).message}\n`)
  process.exit(1)
})
