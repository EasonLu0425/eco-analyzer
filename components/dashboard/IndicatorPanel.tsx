import type { TechnicalIndicators } from '@/types'

const TICKER_SHORT: Record<string, string> = {
  '0050.TW':   '0050',
  '00692.TW':  '00692',
  '00878.TW':  '00878',
  '^TWII':     'TWII',
  '^GSPC':     'GSPC',
}

function fmt(v: number | null, decimals = 2): string {
  return v == null ? 'N/A' : v.toFixed(decimals)
}

function rsiColor(rsi: number | null): string {
  if (rsi == null) return 'text-zinc-500'
  if (rsi >= 70)   return 'text-rose-400'
  if (rsi <= 30)   return 'text-emerald-400'
  return 'text-zinc-300'
}

function macdColor(hist: number | null): string {
  if (hist == null) return 'text-zinc-500'
  return hist >= 0 ? 'text-emerald-400' : 'text-rose-400'
}

function bbLabel(pos: number | null): string {
  if (pos == null) return 'N/A'
  if (pos >= 80) return '超買'
  if (pos <= 20) return '超賣'
  return '正常'
}

function bbColor(pos: number | null): string {
  if (pos == null) return 'text-zinc-500'
  if (pos >= 80 || pos <= 20) return 'text-amber-400'
  return 'text-zinc-300'
}

export function IndicatorPanel({ indicators }: { indicators: TechnicalIndicators[] }) {
  if (indicators.length === 0) {
    return <p className="font-mono text-xs text-zinc-600">無指標資料</p>
  }

  const last = indicators[indicators.length - 1]

  return (
    <div className="w-full">
      <p className="font-mono text-[10px] text-zinc-600 mb-1">
        {TICKER_SHORT[last.ticker] ?? last.ticker} · {last.date}
      </p>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-zinc-900 rounded p-2">
          <p className="font-mono text-[10px] text-zinc-500 mb-0.5">RSI(14)</p>
          <p className={`font-mono text-sm font-bold ${rsiColor(last.rsi14)}`}>
            {fmt(last.rsi14, 1)}
          </p>
        </div>
        <div className="bg-zinc-900 rounded p-2">
          <p className="font-mono text-[10px] text-zinc-500 mb-0.5">MACD 柱</p>
          <p className={`font-mono text-sm font-bold ${macdColor(last.macdHistogram)}`}>
            {fmt(last.macdHistogram, 2)}
          </p>
          <p className="font-mono text-[9px] text-zinc-600">
            線 {fmt(last.macdLine)} / 訊 {fmt(last.macdSignal)}
          </p>
        </div>
        <div className="bg-zinc-900 rounded p-2">
          <p className="font-mono text-[10px] text-zinc-500 mb-0.5">BB位置</p>
          <p className={`font-mono text-sm font-bold ${bbColor(last.bbPosition)}`}>
            {last.bbPosition != null ? `${last.bbPosition.toFixed(0)}%` : 'N/A'}
          </p>
          <p className={`font-mono text-[9px] ${bbColor(last.bbPosition)}`}>
            {bbLabel(last.bbPosition)}
          </p>
        </div>
      </div>
    </div>
  )
}
