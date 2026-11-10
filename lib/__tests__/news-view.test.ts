import { describe, it, expect } from 'vitest'
import type { StoredNewsItem } from '@/types'
import { formatTaipeiTime, groupNewsBySession, safeHref } from '@/lib/news-view'

const stored = (
  url: string,
  session: StoredNewsItem['session'],
  publishedAt: string,
  collectedAt = '2026-11-10T03:00:20.000Z',
): StoredNewsItem => ({
  title: `t ${url}`,
  description: '',
  url,
  publishedAt,
  source: 's',
  collectedDate: '2026-11-10',
  session,
  collectedAt,
})

describe('groupNewsBySession', () => {
  it('returns groups in morning, midday, close order and omits empty sessions', () => {
    const groups = groupNewsBySession([
      stored('c1', 'close', '2026-11-10T05:00:00.000Z'),
      stored('m1', 'morning', '2026-11-10T00:10:00.000Z'),
    ])
    expect(groups.map(g => g.session)).toEqual(['morning', 'close'])
  })

  it('sorts items inside a group newest first', () => {
    const [group] = groupNewsBySession([
      stored('a', 'midday', '2026-11-10T02:00:00.000Z'),
      stored('b', 'midday', '2026-11-10T02:30:00.000Z'),
    ])
    expect(group.items.map(i => i.url)).toEqual(['b', 'a'])
  })

  it('exposes the latest collection time of the group', () => {
    const [group] = groupNewsBySession([
      stored('a', 'midday', '2026-11-10T02:00:00.000Z', '2026-11-10T03:00:10.000Z'),
      stored('b', 'midday', '2026-11-10T02:30:00.000Z', '2026-11-10T03:00:25.000Z'),
    ])
    expect(group.collectedAt).toBe('2026-11-10T03:00:25.000Z')
  })

  it('returns an empty list when there is no news', () => {
    expect(groupNewsBySession([])).toEqual([])
  })
})

describe('formatTaipeiTime', () => {
  it('renders HH:mm in Asia/Taipei', () => {
    expect(formatTaipeiTime('2026-11-10T03:00:00.000Z')).toBe('11:00')
  })

  it('returns a dash for an invalid date', () => {
    expect(formatTaipeiTime('nope')).toBe('—')
  })
})

describe('safeHref', () => {
  it('allows http and https links', () => {
    expect(safeHref('https://news.ltn.com.tw/a')).toBe('https://news.ltn.com.tw/a')
    expect(safeHref('http://example.com/x')).toBe('http://example.com/x')
  })

  it('rejects javascript: and other schemes coming from a feed', () => {
    expect(safeHref('javascript:alert(1)')).toBeNull()
    expect(safeHref('data:text/html,<b>x</b>')).toBeNull()
  })

  it('rejects empty or malformed urls', () => {
    expect(safeHref('')).toBeNull()
    expect(safeHref('not a url')).toBeNull()
  })
})
