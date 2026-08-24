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
          <p className="font-mono text-[9px] text-zinc-600 mt-1 leading-tight">
            {last.rsi14 != null && last.rsi14 >= 70
              ? '漲太多，市場過熱，可能即將下跌'
              : last.rsi14 != null && last.rsi14 <= 30
              ? '跌太多，市場超賣，可能即將反彈'
              : '漲跌幅正常，無明顯訊號'}
          </p>
        </div>
        <div className="bg-zinc-900 rounded p-2">
          <p className="font-mono text-[10px] text-zinc-500 mb-0.5">MACD 柱</p>
          <p className={`font-mono text-sm font-bold ${macdColor(last.macdHistogram)}`}>
            {fmt(last.macdHistogram, 2)}
          </p>
          <p className="font-mono text-[9px] text-zinc-600 mt-1 leading-tight">
            {last.macdHistogram != null && last.macdHistogram > 0
              ? '上漲動能增強，買盤持續進場'
              : last.macdHistogram != null && last.macdHistogram < 0
              ? '上漲動能減弱，賣盤壓力浮現'
              : '動能平衡，方向尚未明確'}
          </p>
        </div>
        <div className="bg-zinc-900 rounded p-2">
          <p className="font-mono text-[10px] text-zinc-500 mb-0.5">BB位置</p>
          <p className={`font-mono text-sm font-bold ${bbColor(last.bbPosition)}`}>
            {last.bbPosition != null ? `${last.bbPosition.toFixed(0)}%` : 'N/A'}
          </p>
          <p className="font-mono text-[9px] text-zinc-600 mt-1 leading-tight">
            {last.bbPosition != null && last.bbPosition >= 80
              ? '價格偏高，接近歷史高波動上緣'
              : last.bbPosition != null && last.bbPosition <= 20
              ? '價格偏低，接近歷史低波動下緣'
              : '價格在正常波動區間內'}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <p className="font-mono text-[9px] text-zinc-700 leading-tight px-1">
          <span className="text-zinc-500">RSI</span> 衡量近期漲跌速度。數值越高代表漲越猛，超過 70 通常是警訊；低於 30 可能是撿便宜時機。
        </p>
        <p className="font-mono text-[9px] text-zinc-700 leading-tight px-1">
          <span className="text-zinc-500">MACD</span> 看買賣力道變化。柱狀往正值走代表多頭力量增強；轉負代表空頭開始主導。
        </p>
        <p className="font-mono text-[9px] text-zinc-700 leading-tight px-1">
          <span className="text-zinc-500">布林帶</span> 把價格放在近期波動範圍內定位。80% 以上代表接近波動上緣，偏貴；20% 以下代表接近下緣，偏便宜。
        </p>
      </div>
    </div>
  )
}
