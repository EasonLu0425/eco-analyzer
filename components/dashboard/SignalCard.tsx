import type { ETFSignal } from '@/types'

const CFG: Record<ETFSignal, { label: string; colorClass: string }> = {
  'strong-buy':   { label: '強力買進', colorClass: 'text-buy' },
  'buy':          { label: '建議買進', colorClass: 'text-buy' },
  'hold':         { label: '觀望',    colorClass: 'text-hold' },
  'avoid':        { label: '避開',    colorClass: 'text-avoid' },
  'strong-avoid': { label: '強烈避開', colorClass: 'text-avoid' },
}

export function SignalCard({ signal, score }: { signal: ETFSignal; score: number }) {
  const c = CFG[signal]
  const scoreClass = score >= 7 ? 'text-buy' : score >= 4 ? 'text-hold' : 'text-avoid'

  return (
    <div className="flex items-end justify-between gap-8">
      <h2 className={`font-display text-[4.5rem] leading-none tracking-tight ${c.colorClass}`}>
        {c.label}
      </h2>
      <div className="text-right pb-1 shrink-0">
        <div className={`font-mono text-4xl font-semibold leading-none ${scoreClass}`}>
          {score.toFixed(1)}
        </div>
        <div className="font-mono text-xs text-ghost mt-1">/ 10</div>
      </div>
    </div>
  )
}
