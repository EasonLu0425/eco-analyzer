import type { ReportSession, StoredNewsItem } from '@/types'
import { formatTaipeiTime, groupNewsBySession, safeHref } from '@/lib/news-view'

const SESSION_LABEL: Record<ReportSession, string> = {
  morning: '早盤',
  midday: '盤中',
  close: '收盤',
}

/** Every news item collected that day, grouped by the session that first saw it. */
export function SessionNewsPanel({ news }: { news: StoredNewsItem[] }) {
  const groups = groupNewsBySession(news)

  if (groups.length === 0) {
    return <p className="text-ghost text-sm">這一天沒有留存的分時段新聞</p>
  }

  return (
    <div className="space-y-4">
      {groups.map((group, idx) => (
        <details key={group.session} open={idx === groups.length - 1} className="group">
          <summary className="cursor-pointer select-none font-mono text-xs text-dim py-1">
            {SESSION_LABEL[group.session]} · 蒐集於 {formatTaipeiTime(group.collectedAt)} · {group.items.length} 則
          </summary>
          <ul className="mt-2">
            {group.items.map(item => {
              const href = safeHref(item.url)
              return (
                <li key={item.url} className="flex items-start gap-3 py-2 border-b border-edge last:border-b-0">
                  <span className="font-mono text-xs text-ghost mt-0.5 w-10 shrink-0">
                    {formatTaipeiTime(item.publishedAt)}
                  </span>
                  <div className="flex-1 min-w-0">
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-ink text-sm leading-snug hover:underline"
                      >
                        {item.title}
                      </a>
                    ) : (
                      <span className="text-ink text-sm leading-snug">{item.title}</span>
                    )}
                    <p className="font-mono text-[10px] text-ghost mt-0.5">{item.source}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        </details>
      ))}
    </div>
  )
}
