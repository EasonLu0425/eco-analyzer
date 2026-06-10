'use client'

import { useState } from 'react'
import type { BacktestResult } from '@/types'

const TICKERS = ['0050.TW', '00692.TW', '00878.TW', '^TWII', '^GSPC'] as const
const TICKER_LABELS: Record<string, string> = {
  '0050.TW':  '元大台灣50 (0050)',
  '00692.TW': '富邦公司治理 (00692)',
  '00878.TW': '國泰永續高股息 (00878)',
  '^TWII':    '台灣加權指數 (TWII)',
  '^GSPC':    'S&P 500 (GSPC)',
}

function StatCard({ label, value, color = 'text-zinc-200' }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-zinc-900 rounded p-4 text-center">
      <p className="font-mono text-[10px] text-zinc-500 mb-1">{label}</p>
      <p className={`font-mono text-lg font-bold ${color}`}>{value}</p>
    </div>
  )
}

function EquityChart({ curve }: { curve: BacktestResult['equityCurve'] }) {
  if (curve.length < 2) return null

  const values = curve.map(p => p.value)
  const minV = Math.min(...values)
  const maxV = Math.max(...values)
  const range = maxV - minV || 1

  const W = 600, H = 120, PAD = 4
  const points = curve.map((p, i) => {
    const x = PAD + (i / (curve.length - 1)) * (W - PAD * 2)
    const y = H - PAD - ((p.value - minV) / range) * (H - PAD * 2)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')

  const last = values[values.length - 1]
  const lineColor = last >= 100 ? '#10b981' : '#f43f5e'

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-28" preserveAspectRatio="none">
      <defs>
        <linearGradient id="eq-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lineColor} stopOpacity="0.25" />
          <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={points} fill="none" stroke={lineColor} strokeWidth="1.5" />
    </svg>
  )
}

export default function BacktestPage() {
  const [ticker, setTicker] = useState<string>('0050.TW')
  const [result, setResult] = useState<BacktestResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/backtest?ticker=${encodeURIComponent(ticker)}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? '未知錯誤')
      setResult(json.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : '請求失敗')
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  const retColor = (v: number) => v >= 0 ? 'text-emerald-400' : 'text-rose-400'

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="font-mono text-sm text-zinc-400 mb-1">回測分析</h1>
      <p className="font-mono text-[10px] text-zinc-600 mb-6">
        依據歷史分析訊號（buy/strong-buy → 進場，avoid/strong-avoid → 出場）模擬績效
      </p>

      <div className="flex gap-3 mb-8">
        <select
          value={ticker}
          onChange={e => setTicker(e.target.value)}
          className="font-mono text-xs bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-zinc-200 flex-1"
        >
          {TICKERS.map(t => (
            <option key={t} value={t}>{TICKER_LABELS[t] ?? t}</option>
          ))}
        </select>
        <button
          onClick={run}
          disabled={loading}
          className="font-mono text-xs bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-200 px-5 py-2 rounded transition-colors"
        >
          {loading ? '計算中…' : '執行回測'}
        </button>
      </div>

      {error && <p className="font-mono text-xs text-rose-400 mb-6">{error}</p>}

      {result && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <StatCard
              label="總報酬率"
              value={`${result.totalReturn >= 0 ? '+' : ''}${result.totalReturn.toFixed(1)}%`}
              color={retColor(result.totalReturn)}
            />
            <StatCard
              label="年化報酬"
              value={`${result.annualizedReturn >= 0 ? '+' : ''}${result.annualizedReturn.toFixed(1)}%`}
              color={retColor(result.annualizedReturn)}
            />
            <StatCard
              label="最大回撤"
              value={`-${result.maxDrawdown.toFixed(1)}%`}
              color="text-amber-400"
            />
            <StatCard
              label="勝率 / 筆數"
              value={`${result.winRate.toFixed(0)}% / ${result.tradeCount}`}
            />
          </div>

          <div className="mb-6">
            <p className="font-mono text-[10px] text-zinc-600 mb-2">資金曲線（基準=100）</p>
            <EquityChart curve={result.equityCurve} />
          </div>

          {result.trades.length > 0 && (
            <div>
              <p className="font-mono text-[10px] text-zinc-600 mb-2">交易記錄</p>
              <div className="overflow-x-auto">
                <table className="w-full font-mono text-[10px]">
                  <thead>
                    <tr className="text-zinc-500 border-b border-zinc-800">
                      <th className="text-left py-1 pr-3">進場</th>
                      <th className="text-left py-1 pr-3">出場</th>
                      <th className="text-right py-1 pr-3">天數</th>
                      <th className="text-right py-1 pr-3">進場價</th>
                      <th className="text-right py-1 pr-3">出場價</th>
                      <th className="text-right py-1">報酬</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.trades.map((t, i) => (
                      <tr key={i} className="border-b border-zinc-900">
                        <td className="py-1 pr-3 text-zinc-400">{t.entryDate}</td>
                        <td className="py-1 pr-3 text-zinc-400">{t.exitDate}</td>
                        <td className="py-1 pr-3 text-right text-zinc-400">{t.holdingDays}</td>
                        <td className="py-1 pr-3 text-right text-zinc-400">{t.entryPrice.toFixed(2)}</td>
                        <td className="py-1 pr-3 text-right text-zinc-400">{t.exitPrice.toFixed(2)}</td>
                        <td className={`py-1 text-right font-bold ${retColor(t.returnPct)}`}>
                          {t.returnPct >= 0 ? '+' : ''}{t.returnPct.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <p className="font-mono text-[10px] text-zinc-700 mt-4">
            回測期間：{result.fromDate} — {result.toDate}
          </p>
        </>
      )}
    </div>
  )
}
