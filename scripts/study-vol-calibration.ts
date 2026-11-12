/**
 * Walk-forward calibration of the volatility interval (lib/vol-forecast.ts).
 * For every non-overlapping decision day (every h-th bar, averaged over all h offsets) the
 * forecast uses only data up to that day; we then check whether the realized h-day return
 * landed inside the nominal 80% interval.
 *
 * Usage: tsx scripts/study-vol-calibration.ts
 */
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { getPriceHistory } from '../lib/price-store'
import { taipeiToday } from '../lib/report-store'
import { HORIZONS, volForecast, type Horizon } from '../lib/vol-forecast'

const TICKERS = ['^TWII', '0050.TW', '^GSPC'] as const
const START = 1000            // first decision bar (~4 years of warmup)
const NOMINAL = 0.8

interface Cover { horizon: Horizon; n: number; coverage: number; below: number; above: number }

function calibrate(dates: readonly string[], closes: readonly number[], h: Horizon): Cover {
  let hit = 0, below = 0, above = 0, n = 0
  for (let off = 0; off < h; off++) {
    for (let k = START + off; k + h < closes.length; k += h) {
      const f = volForecast(dates, closes, { asOf: dates[k] })
      const iv = f?.intervals.find(i => i.horizon === h)
      if (!iv) continue
      const realized = closes[k + h] / closes[k] - 1
      n++
      if (realized < iv.lo) below++
      else if (realized > iv.hi) above++
      else hit++
    }
  }
  return { horizon: h, n, coverage: n ? hit / n : NaN, below: n ? below / n : NaN, above: n ? above / n : NaN }
}

const p = (v: number): string => `${(v * 100).toFixed(1)}%`

function main(): void {
  const lines = [
    `# 波動區間校準（${taipeiToday()}）`, '',
    `- 名目 ${NOMINAL * 100}% 區間（10%~90% 分位數）；每個決策日只用當日以前的資料`,
    `- 每個期間取所有 offset 的不重疊決策日；n 為各 offset 加總的決策日數（不同 offset 之間彼此重疊，所以獨立樣本數約為 n / 期間）`,
    '- 涵蓋率應接近 80%；低於 80% = 區間太窄（低估風險）', '',
    '| 標的 | 期間 | n | 涵蓋率 | 跌破下界 | 突破上界 |', '|---|---|---|---|---|---|',
  ]
  for (const t of TICKERS) {
    const rec = getPriceHistory(t, 100000)
    const dates = rec.map(r => r.date)
    const closes = rec.map(r => r.close)
    for (const h of HORIZONS) {
      const c = calibrate(dates, closes, h)
      lines.push(`| ${t} | ${h}日 | ${c.n} | ${p(c.coverage)} | ${p(c.below)} | ${p(c.above)} |`)
    }
  }
  const text = lines.join('\n')
  process.stdout.write(text + '\n')
  const dir = join(process.cwd(), 'data', 'studies')
  mkdirSync(dir, { recursive: true })
  const out = join(dir, `vol-calibration-${taipeiToday()}.md`)
  writeFileSync(out, text + '\n', 'utf-8')
  process.stdout.write(`\n已存到 ${out}\n`)
}

main()
