/**
 * Do structured, point-in-time market factors predict forward index returns? (~10 years of data)
 *
 * PRE-REGISTERED before looking at any result: seven factors with an expected sign fixed from
 * economic reasoning, two horizons (5 and 20 trading days), plus one equal-weight composite =
 * 16 tests. Every result is reported, including nulls. With 16 tests the Bonferroni cut-off is
 * p < 0.05/16 ~= 0.003; a single p < 0.05 is NOT evidence.
 *
 *   foreignFlowZ    +  foreign investors buying -> higher
 *   soxMom20        +  semiconductor momentum carries to Taiwan's chip-heavy index
 *   revMomentum     +  bellwethers' revenue growth accelerating -> higher
 *   marginChange20  -  rapid margin build-up = crowding -> lower
 *   vixPct          +  fear spike -> subsequent rebound
 *   tnxChange20     -  rising US yields hurt long-duration equities
 *   usdtwdChange20  -  TWD weakening = capital outflow -> lower
 *
 * Usage: tsx scripts/study-structured.ts
 */
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { evaluateFactor, type FactorStat } from '../lib/factor-eval'
import { BELLWETHERS } from '../lib/macro-config'
import { getSeries, type SeriesPoint } from '../lib/macro-store'
import { getPriceHistory } from '../lib/price-store'
import { taipeiToday } from '../lib/report-store'
import { FEATURE_KEYS, structuredFeatures, trailingZ, type MacroData, type StructuredFeatures } from '../lib/structured-features'

type Key = (typeof FEATURE_KEYS)[number]
const EXPECTED: Record<Key, 1 | -1> = {
  foreignFlowZ: 1, soxMom20: 1, revMomentum: 1, marginChange20: -1, vixPct: 1, tnxChange20: -1, usdtwdChange20: -1,
}
const LABEL: Record<Key, string> = {
  foreignFlowZ: 'H1 外資5日買超(z)', soxMom20: 'H2 費半20日報酬', revMomentum: 'H3 權值股營收YoY加速',
  marginChange20: 'H4 融資餘額20日增幅', vixPct: 'H5 VIX年內分位', tnxChange20: 'H6 美10年債20日變化', usdtwdChange20: 'H7 美元兌台幣20日變化',
}
const HORIZONS = [5, 20] as const
const TARGETS = ['^TWII', '0050.TW'] as const
const N_TESTS = FEATURE_KEYS.length * HORIZONS.length + HORIZONS.length
const BONFERRONI = 0.05 / N_TESTS
const Z_WINDOW = 250
const MIN_COMPOSITE_PARTS = 4

const closesAsSeries = (ticker: string): SeriesPoint[] => getPriceHistory(ticker, 100000).map(r => ({ date: r.date, value: r.close }))

function loadMacro(): MacroData {
  return {
    foreignNet: getSeries('inst_foreign_net'),
    margin: getSeries('margin_balance'),
    sox: closesAsSeries('^SOX'),
    vix: closesAsSeries('^VIX'),
    tnx: closesAsSeries('^TNX'),
    usdtwd: closesAsSeries('TWD=X'),
    revYoy: Object.fromEntries(BELLWETHERS.map(id => [id, getSeries(`rev_yoy:${id}`)])),
  }
}

function composite(series: Record<Key, Array<number | null>>, n: number): Array<number | null> {
  const z = Object.fromEntries(FEATURE_KEYS.map(k => [k, trailingZ(series[k], Z_WINDOW)])) as Record<Key, Array<number | null>>
  return Array.from({ length: n }, (_, i) => {
    const parts = FEATURE_KEYS.map(k => z[k][i]).map((v, j) => (v == null ? null : v * EXPECTED[FEATURE_KEYS[j]]))
    const ok = parts.filter((v): v is number => v != null)
    return ok.length >= MIN_COMPOSITE_PARTS ? ok.reduce((a, b) => a + b, 0) / ok.length : null
  })
}

const f2 = (v: number | null, d = 3): string => (v == null ? 'n/a' : (v >= 0 ? '+' : '') + v.toFixed(d))

function row(name: string, sign: 1 | -1, s: FactorStat): string {
  const years = s.byYear.filter(y => y.ic != null)
  const agree = years.filter(y => Math.sign(y.ic as number) === sign).length
  const dirOk = s.ic == null ? '-' : Math.sign(s.ic) === sign ? '同向' : '反向'
  const sig = s.p != null && s.p < BONFERRONI ? '**通過**' : s.p != null && s.p < 0.05 ? '僅名義顯著' : '否'
  return `| ${name} | ${sign > 0 ? '+' : '-'} | ${s.horizon}日 | ${s.n} | ${f2(s.ic)} | ${f2(s.t, 2)} | ${s.p == null ? 'n/a' : s.p.toFixed(4)} | ${dirOk} | ${agree}/${years.length} | ${sig} |`
}

function section(target: string, data: MacroData): string[] {
  const rec = getPriceHistory(target, 100000)
  const dates = rec.map(r => r.date)
  const closes = rec.map(r => r.close)
  const feats: StructuredFeatures[] = dates.map(d => structuredFeatures(d, data))
  const series = Object.fromEntries(FEATURE_KEYS.map(k => [k, feats.map(f => f[k])])) as Record<Key, Array<number | null>>

  const lines = [
    `## 目標：${target}（${dates[0]} ~ ${dates.at(-1)}，${dates.length} 根日線）`, '',
    '| 因子 | 預期 | 期間 | 樣本/offset | IC | t | p | 方向 | 同向年數 | 過 Bonferroni |', '|---|---|---|---|---|---|---|---|---|---|',
  ]
  for (const h of HORIZONS) {
    for (const k of FEATURE_KEYS) lines.push(row(LABEL[k], EXPECTED[k], evaluateFactor(dates, closes, series[k], h)))
  }
  const comp = composite(series, dates.length)
  for (const h of HORIZONS) lines.push(row('組合（7因子等權，方向已定）', 1, evaluateFactor(dates, closes, comp, h)))
  lines.push('')
  return lines
}

function main(): void {
  const data = loadMacro()
  const header = [
    `# 結構化因子研究（${taipeiToday()}）`, '',
    `- 預先登記 ${FEATURE_KEYS.length} 個因子 x ${HORIZONS.length} 個期間 + 組合 = ${N_TESTS} 次檢定；Bonferroni 門檻 p < ${BONFERRONI.toFixed(4)}`,
    '- IC = 因子與未來報酬的 Spearman 相關（不重疊窗口，對所有起點平均）；正 IC 代表「因子高 → 之後漲」',
    '- 所有輸入只取決策日**之前**的資料（美股收盤、法人/融資、月營收（次月10日起算）皆保守落後）',
    '- 「同向年數」是逐年（重疊樣本）的方向一致性，僅作穩定性參考，不是檢定',
    '- 全部結果都列出，包含不顯著的；名義 p<0.05 但沒過門檻者不視為證據',
    '',
  ]
  const text = [...header, ...TARGETS.flatMap(t => section(t, data))].join('\n')
  process.stdout.write(text + '\n')

  const dir = join(process.cwd(), 'data', 'studies')
  mkdirSync(dir, { recursive: true })
  const out = join(dir, `structured-study-${taipeiToday()}.md`)
  writeFileSync(out, text + '\n', 'utf-8')
  process.stdout.write(`\n已存到 ${out}\n`)
}

main()
