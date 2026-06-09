import type { PriceTrend } from '@/types'

const TICKER_LABELS: Record<string, string> = {
  '00662.TW': '元大富時科技 (00662)',
  'QQQ': 'Nasdaq 100 ETF (QQQ)',
  '^TWII': '台灣加權指數 (TWII)',
}

function ChangeChip({ value }: { value: number | null | undefined }) {
  if (value == null) return <span className="text-slate-600 text-xs">N/A</span>
  const positive = value >= 0
  return (
    <span className={`text-xs font-medium ${positive ? 'text-emerald-400' : 'text-red-400'}`}>
      {positive ? '+' : ''}{value.toFixed(2)}%
    </span>
  )
}

function RangeBar({ current, low, high }: { current: number; low: number; high: number }) {
  if (high <= low) return null
  const pct = Math.min(100, Math.max(0, ((current - low) / (high - low)) * 100))
  return (
    <div className="w-full h-1 bg-white/10 rounded-full mt-1 relative">
      <div className="h-full bg-slate-500 rounded-full" style={{ width: `${pct}%` }} />
      <div
        className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-slate-200 border border-slate-700"
        style={{ left: `calc(${pct}% - 4px)` }}
      />
    </div>
  )
}

function TrendCard({ trend }: { trend: PriceTrend }) {
  const label = TICKER_LABELS[trend.ticker] ?? trend.ticker
  const positionPct =
    trend.high52w && trend.low52w && trend.high52w > trend.low52w
      ? Math.round(((trend.currentClose - trend.low52w) / (trend.high52w - trend.low52w)) * 100)
      : null

  return (
    <div className="bg-[#0d1526] border border-white/[0.06] rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-slate-300 text-sm font-medium leading-tight">{label}</p>
        <span className="text-slate-200 font-mono text-base font-semibold whitespace-nowrap">
          {trend.currentClose.toFixed(2)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
        <div className="flex justify-between">
          <span className="text-slate-500">30日</span>
          <ChangeChip value={trend.change30d} />
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">90日</span>
          <ChangeChip value={trend.change90d} />
        </div>
      </div>

      {trend.high52w != null && trend.low52w != null && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-slate-600">
            <span>52週低 {trend.low52w.toFixed(2)}</span>
            {positionPct != null && (
              <span className="text-slate-500">位置 {positionPct}%</span>
            )}
            <span>52週高 {trend.high52w.toFixed(2)}</span>
          </div>
          <RangeBar current={trend.currentClose} low={trend.low52w} high={trend.high52w} />
        </div>
      )}
    </div>
  )
}

export function PriceTrendPanel({ trends }: { trends: PriceTrend[] }) {
  if (!trends || trends.length === 0) {
    return (
      <p className="text-slate-600 text-sm text-center py-4">
        尚無價格資料 — 執行 <code className="text-slate-500">pnpm fetch-prices</code> 取得
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {trends.map(t => <TrendCard key={t.ticker} trend={t} />)}
    </div>
  )
}
