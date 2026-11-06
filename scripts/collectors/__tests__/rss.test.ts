import { describe, it, expect, vi, beforeEach } from 'vitest'

const parseURL = vi.fn()

vi.mock('rss-parser', () => ({
  default: class {
    parseURL = parseURL
  },
}))

import { collectNews } from '../rss'
import { RSS_SOURCES } from '../sources'

describe('RSS_SOURCES', () => {
  it('uses the live 自由時報財經 feed, not the dead ec.ltn.com.tw one', () => {
    const urls = RSS_SOURCES.map(s => s.url)
    expect(urls).toContain('https://news.ltn.com.tw/rss/business.xml')
    expect(urls).not.toContain('https://ec.ltn.com.tw/rss/news.xml')
  })
})

describe('collectNews', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('names the failing source in the error log and keeps the others', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    parseURL.mockImplementation(async (url: string) => {
      if (url.includes('ltn.com.tw')) throw new Error('Invalid character in tag name')
      return { items: [{ title: '台積電 ETF', link: `${url}/a`, pubDate: '2026-11-06T01:00:00Z', contentSnippet: '' }] }
    })

    const items = await collectNews()

    expect(items.length).toBe(RSS_SOURCES.length - 1)
    const logged = errSpy.mock.calls.flat().join(' ')
    expect(logged).toContain('自由財經')
    expect(logged).toContain('Invalid character in tag name')
    errSpy.mockRestore()
  })
})
