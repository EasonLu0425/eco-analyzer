import type { HeadlineDetail } from '@/types'

const IMPACT_STYLES: Record<string, string> = {
  正面: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  負面: 'text-red-400 bg-red-400/10 border-red-400/20',
  中性: 'text-slate-400 bg-slate-400/10 border-slate-400/20',
}

function getImpactLabel(impact: string): string {
  if (impact.startsWith('正面')) return '正面'
  if (impact.startsWith('負面')) return '負面'
  return '中性'
}

type Headline = HeadlineDetail | string

export function HeadlineList({ headlines }: { headlines: Headline[] }) {
  return (
    <ol className="space-y-3">
      {headlines.map((h, i) => {
        if (typeof h === 'string') {
          return (
            <li key={i} className="flex items-start gap-3 group">
              <span className="font-mono text-xs text-slate-600 mt-0.5 w-5 shrink-0">{String(i + 1).padStart(2, '0')}</span>
              <span className="text-sm text-slate-400 leading-relaxed group-hover:text-slate-300 transition-colors">{h}</span>
            </li>
          )
        }
        const label = getImpactLabel(h.marketImpact)
        const style = IMPACT_STYLES[label] ?? IMPACT_STYLES['中性']
        const detail = h.marketImpact.replace(/^(正面|負面|中性)[：:]\s*/, '')
        return (
          <li key={i} className="flex flex-col gap-1.5 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-colors">
            <div className="flex items-start gap-3">
              <span className="font-mono text-xs text-slate-600 mt-0.5 w-5 shrink-0">{String(i + 1).padStart(2, '0')}</span>
              <span className="text-sm font-medium text-slate-200 leading-snug">{h.title}</span>
            </div>
            {h.summary && (
              <p className="text-xs text-slate-500 leading-relaxed pl-8">{h.summary}</p>
            )}
            {h.marketImpact && (
              <div className="pl-8 flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full border font-medium ${style}`}>{label}</span>
                <span className="text-xs text-slate-500">{detail}</span>
              </div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
