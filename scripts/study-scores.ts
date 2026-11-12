import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { getDb } from '../lib/db'
import { computeIndicators } from '../lib/indicators'
import { getPriceHistory } from '../lib/price-store'
import { taipeiToday } from '../lib/report-store'
import { buildSamples, crossTab, scoreBucket, type ScoreBucket, type TechState } from '../lib/score-study'
import { summarize, type ForwardSummary } from '../lib/signal-study'

const HORIZONS = [5, 20] as const
const MIN_CELL = 5 // cells thinner than this are flagged, not trusted

const BUCKET_LABEL: Record<ScoreBucket, string> = {
  low: '低分 <4 (avoid)',
  mid: '中分 4-6.99 (hold)',
  high: '高分 >=7 (buy)',
}
const STATE_LABEL: Record<TechState, string> = {
  oversold: '超賣(回檔>=8% 或 RSI<35)',
  neutral: '中性',
  overbought: '過熱(RSI>70)',
}

const fmt = (s: ForwardSummary) =>
  `${s.avg >= 0 ? '+' : ''}${s.avg.toFixed(2)}% / ${s.winRate.toFixed(0)}% (n=${s.n}${s.n < MIN_CELL ? ', 樣本少' : ''})`

function loadReports(): Array<{ date: string; score: number }> {
  return getDb()
    .prepare('SELECT date, sentiment_score AS score FROM reports ORDER BY date')
    .all() as Array<{ date: string; score: number }>
}

function section(ticker: string, reports: Array<{ date: string; score: number }>): string[] {
  const rec = getPriceHistory(ticker, 100000)
  if (rec.length === 0) return [`## ${ticker}`, '', '無價格資料，略過。', '']

  const dates = rec.map(r => r.date)
  const closes = rec.map(r => r.close)
  const rsi = computeIndicators(rec, ticker).map(x => x.rsi14)
  const samples = buildSamples(reports, dates, closes, rsi, HORIZONS)

  const lines = [`## ${ticker}（${samples.length} 份報告）`, '']

  for (const h of HORIZONS) {
    lines.push(`### 未來 ${h} 個交易日（平均報酬 / 勝率）`, '')

    const base = summarize(samples.map(s => s.fwd[h]).filter((v): v is number => v != null), 0)
    lines.push(`基準（所有報告日）：${fmt(base)}`, '')

    lines.push('**只看新聞分數**', '', '| 分數區間 | 報酬 / 勝率 |', '|---|---|')
    for (const b of ['low', 'mid', 'high'] as const) {
      const v = samples.filter(s => scoreBucket(s.score) === b).map(s => s.fwd[h]).filter((x): x is number => x != null)
      lines.push(`| ${BUCKET_LABEL[b]} | ${v.length ? fmt(summarize(v, 0)) : '-'} |`)
    }

    lines.push('', '**新聞分數 x 價格位置**', '', '| 分數區間 | 價格位置 | 報酬 / 勝率 |', '|---|---|---|')
    for (const row of crossTab(samples, h)) {
      lines.push(`| ${BUCKET_LABEL[row.bucket]} | ${STATE_LABEL[row.state]} | ${fmt(row.summary)} |`)
    }
    lines.push('')
  }
  return lines
}

function main(): void {
  const tickers = process.argv.slice(2).filter(a => !a.startsWith('--'))
  const targets = tickers.length ? tickers : ['0050.TW', '00692.TW', '00878.TW', '^TWII']
  const reports = loadReports()

  const header = [
    `# 新聞分數 x 技術位置回測（${taipeiToday()}）`, '',
    `- 資料：${reports[0]?.date ?? '-'} ~ ${reports.at(-1)?.date ?? '-'}，共 ${reports.length} 份日報`,
    '- 報告日當天（或之後第一個交易日）收盤進場，報酬未扣成本',
    '- 報酬窗口互相重疊、樣本只有數個月，樣本少於 5 的格子僅供參考',
    '',
  ]
  const text = [...header, ...targets.flatMap(t => section(t, reports))].join('\n')
  process.stdout.write(text + '\n')

  const dir = join(process.cwd(), 'data', 'studies')
  mkdirSync(dir, { recursive: true })
  const out = join(dir, `score-study-${taipeiToday()}.md`)
  writeFileSync(out, text + '\n', 'utf-8')
  process.stdout.write(`\n已存到 ${out}\n`)
}

main()
