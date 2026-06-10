import type { HeadlineDetail } from '@/types'

function getImpactLabel(impact: string) {
  if (impact.startsWith('正面')) return '正面'
  if (impact.startsWith('負面')) return '負面'
  return '中性'
}

type Headline = HeadlineDetail | string

export function HeadlineList({ headlines }: { headlines: Headline[] }) {
  return (
    <ol className="space-y-0">
      {headlines.map((h, i) => {
        const notLast = i < headlines.length - 1
        if (typeof h === 'string') {
          return (
            <li key={i} className={`flex items-start gap-3 py-3 ${notLast ? 'border-b border-edge' : ''}`}>
              <span className="font-mono text-xs text-ghost mt-0.5 w-4 shrink-0">{i + 1}</span>
              <span className="text-dim text-sm leading-relaxed">{h}</span>
            </li>
          )
        }
        const label = getImpactLabel(h.marketImpact)
        const detail = h.marketImpact.replace(/^(正面|負面|中性)[：:]\s*/, '')
        const impactColor = label === '正面' ? 'text-buy' : label === '負面' ? 'text-avoid' : 'text-ghost'
        return (
          <li key={i} className={`flex items-start gap-3 py-3 ${notLast ? 'border-b border-edge' : ''}`}>
            <span className="font-mono text-xs text-ghost mt-0.5 w-4 shrink-0">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <p className="text-ink text-sm leading-snug mb-1">{h.title}</p>
              {h.summary && <p className="text-dim text-xs leading-relaxed mb-1">{h.summary}</p>}
              {h.marketImpact && <span className={`text-xs ${impactColor}`}>{detail}</span>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
