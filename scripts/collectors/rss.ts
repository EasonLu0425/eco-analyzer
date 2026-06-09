import Parser from 'rss-parser'
import type { NewsItem } from '@/types'
import { RSS_SOURCES, RELEVANCE_KEYWORDS } from './sources'

const FETCH_TIMEOUT_MS = 5000
const MAX_ITEMS = 100
const DESCRIPTION_MAX_LEN = 200

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim().slice(0, DESCRIPTION_MAX_LEN)
}

function isRelevant(title: string, description: string): boolean {
  const haystack = (title + ' ' + description).toLowerCase()
  return RELEVANCE_KEYWORDS.some(kw => haystack.includes(kw.toLowerCase()))
}

async function fetchSource(
  parser: Parser,
  name: string,
  url: string,
): Promise<NewsItem[]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const feed = await parser.parseURL(url)
    return (feed.items ?? []).map(item => ({
      title: item.title ?? '',
      description: stripHtml(item.contentSnippet ?? item.content ?? item.summary ?? ''),
      url: item.link ?? '',
      publishedAt: new Date(item.pubDate ?? item.isoDate ?? Date.now()).toISOString(),
      source: name,
    }))
  } finally {
    clearTimeout(timer)
  }
}

export async function collectNews(): Promise<NewsItem[]> {
  const parser = new Parser({ timeout: FETCH_TIMEOUT_MS })

  const results = await Promise.allSettled(
    RSS_SOURCES.map(({ name, url }) => fetchSource(parser, name, url)),
  )

  const all: NewsItem[] = []
  for (const result of results) {
    if (result.status === 'fulfilled') {
      all.push(...result.value)
    } else {
      console.error('[rss] fetch failed:', result.reason)
    }
  }

  const relevant = all.filter(item => isRelevant(item.title, item.description))

  relevant.sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1))

  return relevant.slice(0, MAX_ITEMS)
}
