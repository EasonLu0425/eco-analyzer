/**
 * Build point-in-time analysis inputs: one markdown file per report date holding ONLY what was
 * knowable at that day's close (news published by 15:00 Taipei, indicators from bars <= date).
 * No future prices, no previously stored scores.
 *
 * Usage: tsx scripts/study-pit-prepare.ts <outDir> [--from=YYYY-MM-DD] [--to=YYYY-MM-DD]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { getDb } from '../lib/db'
import { techContext, type TechContext } from '../lib/pit-features'
import { getPriceHistory } from '../lib/price-store'
import type { NewsItem } from '../types'

const TICKERS = ['0050.TW', '00692.TW', '00878.TW', '^TWII'] as const
const MAX_ITEMS = 80
const DESC_CHARS = 90
const CUTOFF_HOUR_TAIPEI = 15 // analysis happens after the 13:30 close

const arg = (name: string): string | undefined =>
  process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1]

/** Instant (ms) of 15:00 Asia/Taipei on `date`. Taipei is UTC+8 with no DST. */
function cutoffMs(date: string): number {
  return Date.parse(`${date}T${String(CUTOFF_HOUR_TAIPEI).padStart(2, '0')}:00:00+08:00`)
}

export function newsForDate(date: string, items: readonly NewsItem[]): NewsItem[] {
  const limit = cutoffMs(date)
  const seen = new Set<string>()
  return items
    .filter(it => {
      const t = Date.parse(it.publishedAt)
      return Number.isFinite(t) && t <= limit && !seen.has(it.url) && seen.add(it.url)
    })
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .slice(0, MAX_ITEMS)
}

const pct = (v: number | null): string => (v == null ? 'n/a' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`)
const num = (v: number | null, d = 1): string => (v == null ? 'n/a' : v.toFixed(d))
const yn = (v: boolean | null): string => (v == null ? 'n/a' : v ? '是' : '否')

function techBlock(ticker: string, c: TechContext | null): string {
  if (!c) return `- ${ticker}：資料不足`
  const rangePos = ((c.close - c.low52w) / (c.high52w - c.low52w)) * 100
  return [
    `- ${ticker}（資料到 ${c.date}）：收盤 ${num(c.close, 2)}｜30日 ${pct(c.change30d)}｜90日 ${pct(c.change90d)}`,
    `  52週區間 ${num(c.low52w, 2)}~${num(c.high52w, 2)}（目前位於 ${num(rangePos, 0)}%）｜距252日收盤高點 ${pct(c.dd252 * 100)}`,
    `  RSI14 ${num(c.rsi14)}｜MACD柱 ${num(c.macdHist, 3)}｜布林位置 ${num(c.bbPos, 0)}%`,
    `  站上MA60：${yn(c.aboveMa60)}｜站上MA200：${yn(c.aboveMa200)}｜MA60近20日變化 ${pct(c.ma60Slope20)}｜趨勢判定：${c.trend}`,
  ].join('\n')
}

function render(date: string, news: NewsItem[], tech: Array<[string, TechContext | null]>): string {
  const lines = news.map(
    (n, i) => `${i + 1}. [${n.source}｜${n.publishedAt.slice(0, 16)}Z] ${n.title}｜${n.description.replace(/\s+/g, ' ').slice(0, DESC_CHARS)}`,
  )
  return [
    `# 分析日：${date}（台北時間 ${CUTOFF_HOUR_TAIPEI}:00，收盤後）`,
    '',
    `## 當日新聞（共 ${news.length} 則，皆為 ${date} ${CUTOFF_HOUR_TAIPEI}:00 前發佈）`,
    '',
    news.length ? lines.join('\n') : '（無新聞）',
    '',
    '## 技術指標與價格（僅含 ' + date + ' 收盤以前的資料）',
    '',
    ...tech.map(([t, c]) => techBlock(t, c)),
    '',
  ].join('\n')
}

function main(): void {
  const outDir = process.argv[2]
  if (!outDir || outDir.startsWith('--')) throw new Error('usage: study-pit-prepare.ts <outDir> [--from=] [--to=]')
  mkdirSync(outDir, { recursive: true })

  const from = arg('from') ?? '0000-00-00'
  const to = arg('to') ?? '9999-99-99'
  const dates = (getDb().prepare('SELECT date FROM reports ORDER BY date').all() as Array<{ date: string }>)
    .map(r => r.date)
    .filter(d => d >= from && d <= to)

  const history = new Map(TICKERS.map(t => [t, getPriceHistory(t, 100000)]))
  let written = 0
  for (const date of dates) {
    const file = join(process.cwd(), 'data', 'news', `${date}.json`)
    const items = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf-8')) as NewsItem[]) : []
    const tech = TICKERS.map(t => [t, techContext(history.get(t) ?? [], date)] as [string, TechContext | null])
    writeFileSync(join(outDir, `${date}.md`), render(date, newsForDate(date, items), tech), 'utf-8')
    written++
  }
  process.stdout.write(`wrote ${written} input files to ${outDir}\n`)
}

main()
