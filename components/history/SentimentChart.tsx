'use client'
import type { AnalysisReport } from '@/types'

const SIGNAL_COLOR: Record<string, string> = {
  'strong-buy': '#10b981', 'buy': '#10b981',
  'hold': '#f59e0b',
  'avoid': '#f43f5e', 'strong-avoid': '#f43f5e',
}

export function SentimentChart({ reports }: { reports: AnalysisReport[] }) {
  if (reports.length < 2) return null
  const sorted = [...reports].sort((a, b) => a.date.localeCompare(b.date)).slice(-30)
  const W = 600, H = 80, pad = 8
  const min = Math.min(...sorted.map(r => r.sentimentScore))
  const max = Math.max(...sorted.map(r => r.sentimentScore))
  const range = max - min || 1
  const pts = sorted.map((r, i) => {
    const x = pad + (i / (sorted.length - 1)) * (W - pad * 2)
    const y = pad + (1 - (r.sentimentScore - min) / range) * (H - pad * 2)
    return { x, y, r }
  })
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const area = `${path} L${pts[pts.length-1].x.toFixed(1)},${H} L${pts[0].x.toFixed(1)},${H} Z`

  return (
    <div className="space-y-1">
      <p className="font-mono text-xs text-ghost">近 {sorted.length} 日情緒走勢</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-16">
        <defs>
          <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#chartGrad)" />
        <path d={path} fill="none" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" fill={SIGNAL_COLOR[p.r.signal]} />
        ))}
      </svg>
      <div className="flex justify-between text-xs text-ghost">
        <span>{sorted[0].date.slice(5)}</span>
        <span>{sorted[sorted.length-1].date.slice(5)}</span>
      </div>
    </div>
  )
}
