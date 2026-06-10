import type { CorrelationResult } from '@/types'

function corrColor(c: number): string {
  if (c >= 0.7)  return 'text-emerald-400'
  if (c >= 0.3)  return 'text-lime-400'
  if (c >= -0.3) return 'text-zinc-400'
  if (c >= -0.7) return 'text-amber-400'
  return 'text-rose-400'
}

function corrLabel(c: number): string {
  if (c >= 0.7)  return '高度正相關'
  if (c >= 0.3)  return '正相關'
  if (c >= -0.3) return '低相關'
  if (c >= -0.7) return '負相關'
  return '高度負相關'
}

export function CorrelationBadge({
  correlation,
  benchmarkTicker = '^GSPC',
}: {
  correlation: CorrelationResult | null
  benchmarkTicker?: string
}) {
  if (!correlation) {
    return (
      <div className="bg-zinc-900 rounded p-2 text-center">
        <p className="font-mono text-[10px] text-zinc-500">vs {benchmarkTicker}</p>
        <p className="font-mono text-xs text-zinc-600">資料不足</p>
      </div>
    )
  }

  const { correlation: c, period, ticker } = correlation
  const color = corrColor(c)

  return (
    <div className="bg-zinc-900 rounded p-2 text-center">
      <p className="font-mono text-[10px] text-zinc-500 mb-0.5">
        {ticker} vs {benchmarkTicker} ({period}d)
      </p>
      <p className={`font-mono text-lg font-bold ${color}`}>
        {c >= 0 ? '+' : ''}{c.toFixed(2)}
      </p>
      <p className={`font-mono text-[10px] ${color}`}>{corrLabel(c)}</p>
    </div>
  )
}
