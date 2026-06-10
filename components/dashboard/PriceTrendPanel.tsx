import type { PriceTrend } from '@/types'

const TICKER_LABELS: Record<string, string> = {
  '0050.TW':  '元大台灣50 (0050)',
  '00692.TW': '富邦公司治理 (00692)',
  '00878.TW': '國泰永續高股息 (00878)',
  '^TWII':    '台灣加權指數 (TWII)',
  '^GSPC':    'S&P 500 指數 (GSPC)',
}

const TICKER_SHORT: Record<string, string> = {
  '0050.TW':  '0050',
  '00692.TW': '00692',
  '00878.TW': '00878',
  '^TWII':    'TWII',
  '^GSPC':    'GSPC',
}

function ChangeChip({ value }: { value: number | null | undefined }) {
  if (value == null) return <span className="font-mono text-xs text-ghost">N/A</span>
  const pos = value >= 0
  return (
    <span className={`font-mono text-xs ${pos ? 'text-buy' : 'text-avoid'}`}>
      {pos ? '+' : ''}{value.toFixed(2)}%
    </span>
  )
}

function TrendRow({ trend, last }: { trend: PriceTrend; last: boolean }) {
  const shortLabel = TICKER_SHORT[trend.ticker] ?? trend.ticker
  const fullLabel = TICKER_LABELS[trend.ticker] ?? trend.ticker

  const positionPct =
    trend.high52w && trend.low52w && trend.high52w > trend.low52w
      ? Math.round(((trend.currentClose - trend.low52w) / (trend.high52w - trend.low52w)) * 100)
      : null

  return (
    <div className={`py-4 ${last ? '' : 'border-b border-edge'}`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <span className="font-mono text-xs text-ghost w-14 shrink-0">{shortLabel}</span>
          <span className="text-dim text-xs truncate hidden sm:block">{fullLabel}</span>
          <span className="font-mono text-ink font-medium">{trend.currentClose.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-6 shrink-0">
          <div className="text-right">
            <p className="font-mono text-xs text-ghost">30日</p>
            <ChangeChip value={trend.change30d} />
          </div>
          <div className="text-right">
            <p className="font-mono text-xs text-ghost">90日</p>
            <ChangeChip value={trend.change90d} />
          </div>
        </div>
      </div>

      {trend.high52w != null && trend.low52w != null && (
        <div className="mt-3 flex items-center gap-3">
          <span className="font-mono text-xs text-ghost w-14 shrink-0">{trend.low52w.toFixed(0)}</span>
          <div className="flex-1 relative h-px bg-edge">
            {positionPct != null && (
              <div
                className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-dim"
                style={{ left: `${positionPct}%` }}
              />
            )}
          </div>
          <span className="font-mono text-xs text-ghost w-14 text-right shrink-0">{trend.high52w.toFixed(0)}</span>
          {positionPct != null && (
            <span className="font-mono text-xs text-ghost w-8 text-right shrink-0">{positionPct}%</span>
          )}
        </div>
      )}
    </div>
  )
}

export function PriceTrendPanel({ trends }: { trends: PriceTrend[] }) {
  if (!trends || trends.length === 0) {
    return (
      <p className="text-ghost text-sm">
        尚無價格資料 — 執行 <code className="font-mono">pnpm fetch-prices</code> 取得
      </p>
    )
  }

  return (
    <div>
      {trends.map((t, i) => (
        <TrendRow key={t.ticker} trend={t} last={i === trends.length - 1} />
      ))}
    </div>
  )
}
