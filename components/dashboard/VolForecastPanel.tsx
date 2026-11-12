import { volRegime, type VolForecast, type VolRegime } from '@/lib/vol-forecast'

const REGIME_LABEL: Record<VolRegime, string> = {
  low: '低波動', normal: '一般', high: '高波動', extreme: '極端高波動', unknown: '資料不足',
}
const REGIME_COLOR: Record<VolRegime, string> = {
  low: 'text-emerald-400', normal: 'text-zinc-400', high: 'text-amber-400', extreme: 'text-rose-400', unknown: 'text-zinc-600',
}

const pct = (v: number): string => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`

export function VolForecastPanel({ forecast, ticker }: { forecast: VolForecast | null; ticker: string }) {
  if (!forecast) {
    return (
      <div className="bg-zinc-900 rounded p-3">
        <p className="font-mono text-xs text-zinc-600">{ticker} 歷史資料不足，無法估計波動區間</p>
      </div>
    )
  }

  const regime = volRegime(forecast.volPercentile)
  const rangeMax = Math.max(...forecast.intervals.map(i => Math.max(-i.lo, i.hi)), Number.EPSILON)
  const barWidth = (v: number): number => Math.min(50, Math.max(0, (v / rangeMax) * 50))

  return (
    <div className="bg-zinc-900 rounded p-3 space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <p className="font-mono text-xs text-zinc-500">{ticker} 之後可能的波動範圍（80% 區間）</p>
        <p className={`font-mono text-xs ${REGIME_COLOR[regime]}`}>
          {REGIME_LABEL[regime]} · 年化 {(forecast.annualizedVol * 100).toFixed(0)}%
          {forecast.volPercentile != null && <> · 近 {forecast.volHistoryYears} 年第 {Math.round(forecast.volPercentile * 100)} 百分位</>}
        </p>
      </div>

      <ul className="space-y-2">
        {forecast.intervals.map(iv => {
          const loW = barWidth(-iv.lo)
          const hiW = barWidth(iv.hi)
          return (
            <li key={iv.horizon} className="grid grid-cols-[3.5rem_1fr_9.5rem] items-center gap-3">
              <span className="font-mono text-xs text-zinc-400">{iv.horizon} 個交易日</span>
              <div className="relative h-2 bg-zinc-800 rounded" role="img" aria-label={`${iv.horizon}日區間 ${pct(iv.lo)} 到 ${pct(iv.hi)}`}>
                <div className="absolute top-0 h-full bg-rose-500/60 rounded-l" style={{ right: '50%', width: `${loW}%` }} />
                <div className="absolute top-0 h-full bg-emerald-500/60 rounded-r" style={{ left: '50%', width: `${hiW}%` }} />
                <div className="absolute top-[-2px] h-3 w-px bg-zinc-500 left-1/2" />
              </div>
              <span className={`font-mono text-xs text-right ${iv.reliable ? 'text-zinc-300' : 'text-zinc-500'}`}>
                {pct(iv.lo)} ~ {pct(iv.hi)}{!iv.reliable && ' *'}
              </span>
            </li>
          )
        })}
      </ul>

      <p className="text-xs leading-relaxed text-zinc-500">
        這是「範圍多寬」的估計，不是漲跌方向：波動大小有延續性（可預測），方向目前沒有可靠預測力。
        區間上下界含樣本期間的平均漲幅，所以常偏向上方，不代表預測會漲。
        10 年逐日回測（data/studies/vol-calibration-*.md）：名目 80% 區間實際涵蓋 5 日約 79–80%、20 日約 79–82%。
        * 60 日獨立樣本只有二十多個，涵蓋率 74–83% 不穩定，僅供參考。
      </p>
    </div>
  )
}
