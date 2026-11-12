/** Pure parsers for FinMind (https://api.finmindtrade.com) datasets. No I/O. */
import type { SeriesPoint } from './macro-store'

export interface InstitutionalRow { date: string; name: string; buy: number; sell: number }
export interface MarginRow { date: string; name: string; TodayBalance: number }
export interface RevenueRow { revenue_year: number; revenue_month: number; revenue: number }

export interface InstitutionalSeries {
  inst_foreign_net: SeriesPoint[]
  inst_trust_net: SeriesPoint[]
  inst_dealer_net: SeriesPoint[]
}

type Group = keyof InstitutionalSeries

function groupOf(name: string): Group | null {
  if (name.startsWith('Foreign')) return 'inst_foreign_net'
  if (name === 'Investment_Trust') return 'inst_trust_net'
  if (name.startsWith('Dealer')) return 'inst_dealer_net'
  return null // 'total' and anything unknown
}

const byDate = (a: SeriesPoint, b: SeriesPoint): number => a.date.localeCompare(b.date)

/** Daily net buy (buy - sell, TWD) per investor group; the pre-aggregated "total" row is ignored. */
export function parseInstitutional(rows: readonly InstitutionalRow[]): InstitutionalSeries {
  const acc: Record<Group, Map<string, number>> = {
    inst_foreign_net: new Map(),
    inst_trust_net: new Map(),
    inst_dealer_net: new Map(),
  }
  for (const r of rows) {
    const g = groupOf(r.name)
    if (!g) continue
    acc[g].set(r.date, (acc[g].get(r.date) ?? 0) + (r.buy - r.sell))
  }
  const toPoints = (m: Map<string, number>): SeriesPoint[] =>
    [...m].map(([date, value]) => ({ date, value })).sort(byDate)
  return {
    inst_foreign_net: toPoints(acc.inst_foreign_net),
    inst_trust_net: toPoints(acc.inst_trust_net),
    inst_dealer_net: toPoints(acc.inst_dealer_net),
  }
}

/** Market-wide margin-purchase money balance (TWD) at each day's close. */
export function parseMarginBalance(rows: readonly MarginRow[]): SeriesPoint[] {
  return rows
    .filter(r => r.name === 'MarginPurchaseMoney')
    .map(r => ({ date: r.date, value: r.TodayBalance }))
    .sort(byDate)
}

/** Latest day a listed company may report month M revenue is the 10th of month M+1; use that as "known from". */
function availableDate(year: number, month: number): string {
  const y = month === 12 ? year + 1 : year
  const m = month === 12 ? 1 : month + 1
  return `${y}-${String(m).padStart(2, '0')}-10`
}

/** Monthly revenue YoY (fraction), dated when it first became knowable. Months without a positive year-ago base are skipped. */
export function parseRevenueYoy(rows: readonly RevenueRow[]): SeriesPoint[] {
  const byKey = new Map(rows.map(r => [`${r.revenue_year}-${r.revenue_month}`, r.revenue]))
  const out: SeriesPoint[] = []
  for (const r of rows) {
    const base = byKey.get(`${r.revenue_year - 1}-${r.revenue_month}`)
    if (base == null || base <= 0) continue
    out.push({ date: availableDate(r.revenue_year, r.revenue_month), value: r.revenue / base - 1 })
  }
  return out.sort(byDate)
}
