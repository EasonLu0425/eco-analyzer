import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { computeIndicators } from '../lib/indicators'
import { getPriceHistory } from '../lib/price-store'
import { taipeiToday } from '../lib/report-store'
import {
  drawdownFromHigh,
  forwardReturns,
  selectEpisodes,
  sma,
  summarize,
  type ForwardSummary,
} from '../lib/signal-study'

const HORIZONS = [5, 20, 60] as const
const ROUND_TRIP_COST_PCT = 0.45 // 0.1425% fee x2 + 0.1% ETF transaction tax
const MIN_HISTORY = 260          // need MA200 / 252-day high to be defined

interface Features {
  dates: string[]
  closes: number[]
  rsi: (number | null)[]
  bbPos: (number | null)[]
  macdHist: (number | null)[]
  highs: number[]
  ma60: (number | null)[]
  ma120: (number | null)[]
  ma200: (number | null)[]
  dd60: number[]
  dd252: number[]
}

type Rule = { name: string; side: 'buy' | 'sell'; test: (f: Features, i: number) => boolean }

const rsiBelow = (t: number) => (f: Features, i: number) => (f.rsi[i] ?? 100) < t
const minRsiRecent = (f: Features, i: number, n: number) =>
  Math.min(...f.rsi.slice(Math.max(0, i - n + 1), i + 1).map(v => v ?? 100))
const reversalBar = (f: Features, i: number) =>
  i > 0 &&
  f.closes[i] > f.highs[i - 1] &&
  (f.macdHist[i] ?? -Infinity) > (f.macdHist[i - 1] ?? Infinity)
const belowMa = (ma: (number | null)[]) => (f: Features, i: number) => ma[i] != null && f.closes[i] < (ma[i] as number)
const aboveMa = (ma: (number | null)[]) => (f: Features, i: number) => ma[i] != null && f.closes[i] >= (ma[i] as number)

const RULES: Rule[] = [
  { name: 'B1 RSI<30', side: 'buy', test: rsiBelow(30) },
  { name: 'B2 RSI<35', side: 'buy', test: rsiBelow(35) },
  { name: 'B3 布林位置<10%', side: 'buy', test: (f, i) => (f.bbPos[i] ?? 100) < 10 },
  { name: 'B4 距60日高回檔>=10%', side: 'buy', test: (f, i) => f.dd60[i] <= -0.1 },
  { name: 'B5 距252日高回檔>=15%', side: 'buy', test: (f, i) => f.dd252[i] <= -0.15 },
  { name: 'B6 回檔>=10% 且 RSI<35', side: 'buy', test: (f, i) => f.dd60[i] <= -0.1 && (f.rsi[i] ?? 100) < 35 },
  {
    name: 'B7 近5日RSI<35 + 反轉K(收>前高,MACD柱升)',
    side: 'buy',
    test: (f, i) => minRsiRecent(f, i, 5) < 35 && reversalBar(f, i),
  },
  {
    name: 'B8 回檔>=10% 且 反轉K',
    side: 'buy',
    test: (f, i) => f.dd60[i] <= -0.1 && reversalBar(f, i),
  },
  { name: 'S1 RSI>70', side: 'sell', test: (f, i) => (f.rsi[i] ?? 0) > 70 },
  { name: 'S2 布林位置>95%', side: 'sell', test: (f, i) => (f.bbPos[i] ?? 0) > 95 },
  {
    name: 'S3 高於半年線15%以上',
    side: 'sell',
    test: (f, i) => f.ma120[i] != null && f.closes[i] > (f.ma120[i] as number) * 1.15,
  },
  {
    name: 'S4 跌破季線(MA60)',
    side: 'sell',
    test: (f, i) => i > 0 && f.ma60[i] != null && f.ma60[i - 1] != null &&
      f.closes[i] < (f.ma60[i] as number) && f.closes[i - 1] >= (f.ma60[i - 1] as number),
  },
]

const fmt = (s: ForwardSummary) =>
  s.n === 0 ? '    -    ' : `${s.avg >= 0 ? '+' : ''}${s.avg.toFixed(1)}%/${s.winRate.toFixed(0)}%`

function buildFeatures(ticker: string): Features {
  const rec = getPriceHistory(ticker, 100000)
  const ind = computeIndicators(rec, ticker)
  const closes = rec.map(r => r.close)
  return {
    dates: rec.map(r => r.date),
    closes,
    rsi: ind.map(x => x.rsi14),
    bbPos: ind.map(x => x.bbPosition),
    macdHist: ind.map(x => x.macdHistogram),
    highs: rec.map(r => r.high),
    ma60: sma(closes, 60),
    ma120: sma(closes, 120),
    ma200: sma(closes, 200),
    dd60: drawdownFromHigh(closes, 60),
    dd252: drawdownFromHigh(closes, 252),
  }
}

function evaluate(f: Features, rule: Rule, horizon: number, filter: (i: number) => boolean = () => true): ForwardSummary {
  const flags = f.closes.map((_, i) => i >= MIN_HISTORY && filter(i) && rule.test(f, i))
  const episodes = selectEpisodes(flags, horizon)
  // Buy rules pay costs; sell rules are read as "what happened next if you had held", so no cost.
  return summarize(forwardReturns(f.closes, episodes, horizon), rule.side === 'buy' ? ROUND_TRIP_COST_PCT : 0)
}

function baseline(f: Features, horizon: number): ForwardSummary {
  const idx = f.closes.map((_, i) => i).filter(i => i >= MIN_HISTORY)
  return summarize(forwardReturns(f.closes, idx, horizon), 0)
}

function mainTable(f: Features): string[] {
  const lines = ['| 規則 | 次數(20日) | 5日 均/勝 | 20日 均/勝 | 60日 均/勝 | 20日最差 |', '|---|---|---|---|---|---|']
  const base = HORIZONS.map(h => baseline(f, h))
  lines.push(`| 基準：任一天買進持有(未扣成本) | ${base[1].n} | ${base.map(fmt).join(' | ')} | ${base[1].worst.toFixed(1)}% |`)
  for (const rule of RULES) {
    const res = HORIZONS.map(h => evaluate(f, rule, h))
    lines.push(`| ${rule.name} | ${res[1].n} | ${res.map(fmt).join(' | ')} | ${res[1].n ? res[1].worst.toFixed(1) + '%' : '-'} |`)
  }
  return lines
}

function splitTable(f: Features, ruleNames: string[]): string[] {
  const mid = Math.floor((MIN_HISTORY + f.closes.length) / 2)
  const segs: Array<[string, (i: number) => boolean]> = [
    [`前半(${f.dates[MIN_HISTORY]}~${f.dates[mid]})`, i => i < mid],
    [`後半(${f.dates[mid]}~${f.dates.at(-1)})`, i => i >= mid],
    ['多頭(收盤>=MA200)', i => aboveMa(f.ma200)(f, i)],
    ['空頭(收盤<MA200)', i => belowMa(f.ma200)(f, i)],
  ]
  const lines = [`| 規則(20日) | ${segs.map(s => s[0]).join(' | ')} |`, `|---|${segs.map(() => '---').join('|')}|`]
  for (const name of ruleNames) {
    const rule = RULES.find(r => r.name.startsWith(name))
    if (!rule) continue
    const cells = segs.map(([, flt]) => {
      const s = evaluate(f, rule, 20, flt)
      return s.n ? `${fmt(s)} (n=${s.n})` : '-'
    })
    lines.push(`| ${rule.name} | ${cells.join(' | ')} |`)
  }
  const baseCells = segs.map(([, flt]) => {
    const idx = f.closes.map((_, i) => i).filter(i => i >= MIN_HISTORY && flt(i))
    const s = summarize(forwardReturns(f.closes, idx, 20), 0)
    return `${fmt(s)} (n=${s.n})`
  })
  lines.push(`| 基準：任一天買進 | ${baseCells.join(' | ')} |`)
  return lines
}

function report(ticker: string): string[] {
  const f = buildFeatures(ticker)
  if (f.closes.length < MIN_HISTORY + 80) return [`## ${ticker}`, '', `資料不足（${f.closes.length} 筆），略過。`, '']
  return [
    `## ${ticker}（${f.dates[0]} ~ ${f.dates.at(-1)}，${f.closes.length} 根日線）`,
    '', '### 全期間', '', ...mainTable(f),
    '', '### 穩定性：前後半段 / 多空頭（只列買進規則，20日）', '',
    ...splitTable(f, ['B1', 'B2', 'B3', 'B4', 'B6', 'B7', 'B8']),
    '',
  ]
}

function main() {
  const tickers = process.argv.slice(2).filter(a => !a.startsWith('--'))
  const targets = tickers.length ? tickers : ['^TWII', '0050.TW', '00692.TW', '00878.TW']
  const header = [
    `# 買賣訊號回測（${taipeiToday()}）`, '',
    `- 格式：平均報酬 / 勝率；買進規則已扣來回成本 ${ROUND_TRIP_COST_PCT}%，賣出規則與基準未扣`,
    '- 訊號當天收盤進場；同一波訊號依持有天數合併成一次（冷卻期=持有天數），避免重複計次',
    `- 前 ${MIN_HISTORY} 根不評估（讓 MA200、252日高點有定義）`, '',
  ]
  const body = targets.flatMap(report)
  const text = [...header, ...body].join('\n')
  console.log(text)

  const dir = join(process.cwd(), 'data', 'studies')
  mkdirSync(dir, { recursive: true })
  const out = join(dir, `signal-study-${taipeiToday()}.md`)
  writeFileSync(out, text + '\n', 'utf-8')
  console.log(`\n已存到 ${out}`)
}

main()
