import type { ETFSignal } from '@/types'

const CFG: Record<ETFSignal, { label: string; color: string; bg: string; border: string; dot: string }> = {
  'strong-buy':  { label: '強力買進', color: 'text-emerald-400', bg: 'from-emerald-500/10 to-emerald-500/5', border: 'border-emerald-500/20', dot: 'bg-emerald-400' },
  'buy':         { label: '建議買進', color: 'text-emerald-400', bg: 'from-emerald-500/10 to-emerald-500/5', border: 'border-emerald-500/20', dot: 'bg-emerald-400' },
  'hold':        { label: '觀望',    color: 'text-amber-400',   bg: 'from-amber-500/10 to-amber-500/5',    border: 'border-amber-500/20',   dot: 'bg-amber-400' },
  'avoid':       { label: '避開',    color: 'text-rose-400',    bg: 'from-rose-500/10 to-rose-500/5',      border: 'border-rose-500/20',    dot: 'bg-rose-400' },
  'strong-avoid':{ label: '強烈避開', color: 'text-rose-400',   bg: 'from-rose-500/10 to-rose-500/5',      border: 'border-rose-500/20',    dot: 'bg-rose-400' },
}

export function SignalCard({ signal, score }: { signal: ETFSignal; score: number }) {
  const c = CFG[signal]
  const scoreColor = score >= 7 ? '#10b981' : score >= 4 ? '#f59e0b' : '#f43f5e'
  return (
    <div className={`relative overflow-hidden rounded-2xl border ${c.border} bg-gradient-to-br ${c.bg} p-8`}>
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
      <div className="flex items-center gap-3 mb-6">
        <span className={`w-3 h-3 rounded-full ${c.dot} animate-pulse`} />
        <span className="text-slate-400 text-sm font-medium uppercase tracking-wider">科技 ETF 訊號</span>
      </div>
      <div className={`text-5xl font-bold tracking-tight ${c.color} mb-6`}>{c.label}</div>
      <div className="space-y-1.5">
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">情緒分數</span>
          <span className="font-mono font-semibold" style={{ color: scoreColor }}>{score.toFixed(1)} / 10</span>
        </div>
        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(score / 10) * 100}%`, backgroundColor: scoreColor }} />
        </div>
      </div>
    </div>
  )
}
