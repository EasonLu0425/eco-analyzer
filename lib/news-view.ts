import { REPORT_SESSIONS, type ReportSession, type StoredNewsItem } from '@/types'

export interface SessionNewsGroup {
  session: ReportSession
  collectedAt: string          // latest collection time among the group's items
  items: StoredNewsItem[]      // newest first
}

/** Group a day's stored news by the session that first saw it, in morning → midday → close order. */
export function groupNewsBySession(items: readonly StoredNewsItem[]): SessionNewsGroup[] {
  return REPORT_SESSIONS.flatMap(session => {
    const inSession = items
      .filter(i => i.session === session)
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    if (inSession.length === 0) return []
    const collectedAt = inSession.reduce((max, i) => (i.collectedAt > max ? i.collectedAt : max), '')
    return [{ session, collectedAt, items: inSession }]
  })
}

export function formatTaipeiTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
}

/** Feed-supplied URLs are untrusted: only plain http(s) links may become an href. */
export function safeHref(url: string): string | null {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : null
  } catch {
    return null
  }
}
