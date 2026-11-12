/**
 * Score the point-in-time predictions (scripts/study-pit-prepare.ts + analyst agents) against what
 * prices actually did afterwards, and compare with the scores stored by the old pipeline.
 *
 * Usage: tsx scripts/study-pit-backtest.ts <predictionsDir>   (dir of <date>.json files)
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { getDb } from '../lib/db'
import { getMeta } from '../lib/meta-store'
import { getPriceHistory } from '../lib/price-store'
import { taipeiToday } from '../lib/report-store'
import { buildSamples, simulateExposure, spearman } from '../lib/score-study'
import { summarize, type ForwardSummary } from '../lib/signal-study'

const HORIZONS = [1, 5, 10, 20] as const
const TICKERS = ['0050.TW', '00692.TW', '00878.TW', '^TWII'] as const
const SIGNALS = ['strong-buy', 'buy', 'hold', 'avoid', 'strong-avoid'] as const
type Signal = (typeof SIGNALS)[number]
const MIN_CELL = 5
/** First report date produced by the two-layer (fundamentals + technicals) logic; earlier reports are the old logic. */
const LOGIC_V2_META_KEY = 'logic_v2_start'

interface Pred { date: string; score: number; signal: Signal }

const bandOf = (score: number): Signal =>
  score >= 8.5 ? 'strong-buy' : score >= 7 ? 'buy' : score >= 4 ? 'hold' : score >= 2 ? 'avoid' : 'strong-avoid'

function loadPredictions(dir: string): { preds: Pred[]; problems: string[] } {
  const problems: string[] = []
  const preds: Pred[] = []
  for (const f of readdirSync(dir).filter(n => n.endsWith('.json')).sort()) {
    try {
      const j = JSON.parse(readFileSync(join(dir, f), 'utf-8')) as { sentimentScore?: number; signal?: string }
      const date = f.slice(0, -5)
      const score = j.sentimentScore
      if (typeof score !== 'number' || !SIGNALS.includes(j.signal as Signal)) throw new Error('bad score/signal')
      if (bandOf(score) !== j.signal) problems.push(`${date}: signal ${j.signal} 與分數 ${score} 不符，改以分數推導`)
      preds.push({ date, score, signal: bandOf(score) })
    } catch (e) {
      problems.push(`${f}: ${(e as Error).message}`)
    }
  }
  return { preds, problems }
}

const fmt = (s: ForwardSummary): string =>
  s.n === 0 ? '-' : `${s.avg >= 0 ? '+' : ''}${s.avg.toFixed(2)}% / ${s.winRate.toFixed(0)}% (n=${s.n}${s.n < MIN_CELL ? ', 樣本少' : ''})`
const rho = (v: number | null): string => (v == null ? 'n/a' : v.toFixed(3))

function perTicker(ticker: string, preds: Pred[], oldScores: Map<string, number>): string[] {
  const rec = getPriceHistory(ticker, 100000)
  const dates = rec.map(r => r.date)
  const dateSet = new Set(dates)
  const tradable = preds.filter(p => dateSet.has(p.date)) // drop weekend/holiday report dates
  const rsi = rec.map(() => null)
  const samples = buildSamples(tradable.map(p => ({ date: p.date, score: p.score })), dates, rec.map(r => r.close), rsi, HORIZONS)
  const lines = [`## ${ticker}（${tradable.length} 個交易日預測）`, '']

  lines.push('| 預測訊號 | 天數 | ' + HORIZONS.map(h => `${h}日 報酬/勝率`).join(' | ') + ' |', '|---|---|' + HORIZONS.map(() => '---').join('|') + '|')
  const pick = (idx: number[], h: number) => idx.map(i => samples[i].fwd[h]).filter((v): v is number => v != null)
  const all = tradable.map((_, i) => i)
  lines.push(`| 基準（全部） | ${all.length} | ${HORIZONS.map(h => fmt(summarize(pick(all, h), 0))).join(' | ')} |`)
  for (const sig of SIGNALS) {
    const idx = all.filter(i => tradable[i].signal === sig)
    if (idx.length) lines.push(`| ${sig} | ${idx.length} | ${HORIZONS.map(h => fmt(summarize(pick(idx, h), 0))).join(' | ')} |`)
  }

  const corr = (h: number, scores: number[]) => {
    const pairs = scores.map((s, i) => [s, samples[i].fwd[h]] as const).filter((p): p is readonly [number, number] => p[1] != null)
    return spearman(pairs.map(p => p[0]), pairs.map(p => p[1]))
  }
  const newScores = tradable.map(p => p.score)
  const oldAligned = tradable.map(p => oldScores.get(p.date) ?? NaN)
  lines.push('', '**分數與未來報酬的 Spearman 相關（越正代表分數越能預測上漲）**', '', '| 分數來源 | 5日 | 10日 | 20日 |', '|---|---|---|---|')
  lines.push(`| 新邏輯（盲測） | ${[5, 10, 20].map(h => rho(corr(h, newScores))).join(' | ')} |`)
  if (oldAligned.every(Number.isFinite)) {
    lines.push(`| 舊邏輯（DB 現有） | ${[5, 10, 20].map(h => rho(corr(h, oldAligned))).join(' | ')} |`)
  }
  lines.push('')
  return lines
}

function loadForwardPredictions(start: string): Pred[] {
  const rows = getDb()
    .prepare("SELECT date, data FROM report_snapshots WHERE session = 'close' AND date >= ? ORDER BY date")
    .all(start) as Array<{ date: string; data: string }>
  return rows.map(r => {
    const score = (JSON.parse(r.data) as { sentimentScore: number }).sentimentScore
    return { date: r.date, score, signal: bandOf(score) }
  })
}

function strategyTable(preds: Pred[], oldSignals?: Map<string, Signal>): string[] {
  const rec = getPriceHistory('0050.TW', 100000)
  const firstIdx = rec.findIndex(r => r.date >= preds[0].date)
  const closes = rec.slice(firstIdx).map(r => r.close)
  const dates = rec.slice(firstIdx).map(r => r.date)
  const byDate = new Map(preds.map(p => [p.date, p.signal]))

  const expo = (sigs: Map<string, Signal>, rule: (s: Signal) => number): number[] => {
    let last: Signal = 'hold'
    return dates.map(d => { last = sigs.get(d) ?? last; return rule(last) })
  }
  const rows: Array<[string, number[]]> = [
    ['買進持有 0050', dates.map(() => 1)],
    ['新邏輯：出現 avoid 後空手，其餘持有', expo(byDate, s => (s === 'avoid' || s === 'strong-avoid' ? 0 : 1))],
    ['新邏輯：只在 buy/strong-buy 後持有', expo(byDate, s => (s === 'buy' || s === 'strong-buy' ? 1 : 0))],
    ...(oldSignals
      ? ([
          ['舊邏輯：出現 avoid 後空手，其餘持有', expo(oldSignals, s => (s === 'avoid' || s === 'strong-avoid' ? 0 : 1))],
          ['舊邏輯：只在 buy/strong-buy 後持有', expo(oldSignals, s => (s === 'buy' || s === 'strong-buy' ? 1 : 0))],
        ] as Array<[string, number[]]>)
      : []),
  ]
  const lines = [`## 依訊號持有 0050（${dates[0]} ~ ${dates.at(-1)}，未扣成本）`, '', '| 策略 | 總報酬 | 最大回檔 | 持有天數 |', '|---|---|---|---|']
  for (const [name, e] of rows) {
    const r = simulateExposure(closes, e)
    lines.push(`| ${name} | ${r.totalReturnPct.toFixed(2)}% | ${r.maxDrawdownPct.toFixed(2)}% | ${r.daysInMarket}/${closes.length - 1} |`)
  }
  lines.push('')
  return lines
}

const USAGE = 'usage: study-pit-backtest.ts <predictionsDir>  |  study-pit-backtest.ts --from-db[=YYYY-MM-DD]'

function main(): void {
  const arg = process.argv[2]
  if (!arg) throw new Error(USAGE)
  const forward = arg.startsWith('--from-db')

  let preds: Pred[]
  let problems: string[] = []
  let start = ''
  if (forward) {
    start = arg.split('=')[1] ?? getMeta(LOGIC_V2_META_KEY) ?? ''
    if (!start) throw new Error(`no start date: pass --from-db=YYYY-MM-DD or set meta "${LOGIC_V2_META_KEY}"`)
    preds = loadForwardPredictions(start)
  } else {
    ;({ preds, problems } = loadPredictions(arg))
  }
  if (preds.length === 0) {
    process.stdout.write(forward ? `尚無 ${start} 起的 close 快照，沒有可評估的事前預測。\n` : '找不到預測檔。\n')
    return
  }

  // Old-logic comparison only makes sense for the historical replay; in forward mode `reports` IS the new logic.
  const old = forward ? [] : (getDb().prepare('SELECT date, sentiment_score AS score FROM reports').all() as Array<{ date: string; score: number }>)
  const oldScores = new Map(old.map(o => [o.date, o.score]))
  const oldSignals = forward ? undefined : new Map(old.map(o => [o.date, bandOf(o.score)]))

  const dist = SIGNALS.map(s => `${s}=${preds.filter(p => p.signal === s).length}`).join('｜')
  const scores = preds.map(p => p.score)
  const header = [
    forward ? `# 事前預測追蹤（新邏輯 ${start} 起，${taipeiToday()}）` : `# 盲測預測回測（${taipeiToday()}）`, '',
    `- 預測 ${preds.length} 天（${preds[0].date} ~ ${preds.at(-1)?.date}）；訊號分布：${dist}`,
    `- 分數範圍 ${Math.min(...scores)} ~ ${Math.max(...scores)}`,
    forward
      ? '- 來源：report_snapshots 的 close 時段（收盤後產生，預測當下尚無之後的價格）；尚未滿窗口的報酬不計入'
      : '- 每天由獨立 agent 只看當日 15:00 前的新聞與當日收盤前的指標（不含未來價格、不含舊分數）',
    '- 報酬自預測日收盤起算；週末/休市日的報告略過；報酬窗口重疊，樣本少於 5 的格子僅供參考',
    ...(forward ? [] : ['- 此區間 0050 淨值幾乎持平（約 -1.6%）、中間回檔約 20%，不是單邊多頭']),
    ...(problems.length ? ['', '**資料問題**', ...problems.map(p => `- ${p}`)] : []),
    '',
  ]
  const body = [...TICKERS.flatMap(t => perTicker(t, preds, oldScores)), ...strategyTable(preds, oldSignals)]
  const text = [...header, ...body].join('\n')
  process.stdout.write(text + '\n')

  const outDir = join(process.cwd(), 'data', 'studies')
  mkdirSync(outDir, { recursive: true })
  const out = join(outDir, `${forward ? 'forward' : 'pit'}-backtest-${taipeiToday()}.md`)
  writeFileSync(out, text + '\n', 'utf-8')
  process.stdout.write(`\n已存到 ${out}\n`)
}

main()
