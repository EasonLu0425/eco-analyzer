import { describe, it, expect, vi, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import type { AnalysisReport } from '@/types'
import { runMigrations } from '@/lib/db'
import { saveReport } from '@/lib/report-store'

vi.mock('@/scripts/collectors', () => ({
  collectNews: vi.fn(),
}))

import { queryReportsByDateRange, queryReportsBySignal, getLatestNews } from '@/lib/agents/tools'
import { collectNews } from '@/scripts/collectors'

function makeDb() {
  const db = new Database(':memory:')
  runMigrations(db)
  return db
}

function makeReport(overrides: Partial<AnalysisReport>): AnalysisReport {
  return {
    id: overrides.date ?? '2026-01-01',
    date: '2026-01-01',
    sentimentScore: 5,
    signal: 'hold',
    summary: '測試摘要',
    risks: ['風險1'],
    topHeadlines: ['標題1'],
    newsCount: 3,
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('queryReportsByDateRange', () => {
  it('returns reports within the inclusive date range, newest first', () => {
    const db = makeDb()
    saveReport(makeReport({ id: 'a', date: '2026-01-01', signal: 'buy' }), db)
    saveReport(makeReport({ id: 'b', date: '2026-01-05', signal: 'hold' }), db)
    saveReport(makeReport({ id: 'c', date: '2026-01-10', signal: 'avoid' }), db)

    const result = queryReportsByDateRange('2026-01-01', '2026-01-05', db)

    expect(result.map(r => r.date)).toEqual(['2026-01-05', '2026-01-01'])
  })

  it('returns empty array when no reports fall in range', () => {
    const db = makeDb()
    saveReport(makeReport({ id: 'a', date: '2026-01-01' }), db)

    const result = queryReportsByDateRange('2026-02-01', '2026-02-28', db)

    expect(result).toEqual([])
  })
})

describe('queryReportsBySignal', () => {
  it('filters by signal and respects limit', () => {
    const db = makeDb()
    saveReport(makeReport({ id: 'a', date: '2026-01-01', signal: 'buy' }), db)
    saveReport(makeReport({ id: 'b', date: '2026-01-02', signal: 'buy' }), db)
    saveReport(makeReport({ id: 'c', date: '2026-01-03', signal: 'hold' }), db)

    const result = queryReportsBySignal('buy', 1, db)

    expect(result).toHaveLength(1)
    expect(result[0].signal).toBe('buy')
    expect(result[0].date).toBe('2026-01-02')
  })

  it('returns empty array when signal has no matches', () => {
    const db = makeDb()
    saveReport(makeReport({ id: 'a', date: '2026-01-01', signal: 'buy' }), db)

    const result = queryReportsBySignal('strong-avoid', 10, db)

    expect(result).toEqual([])
  })
})

describe('getLatestNews', () => {
  beforeEach(() => {
    vi.mocked(collectNews).mockReset()
  })

  it('returns up to limit items from collectNews', async () => {
    vi.mocked(collectNews).mockResolvedValue([
      { title: '新聞1', description: '', url: '', publishedAt: '2026-01-01', source: '測試' },
      { title: '新聞2', description: '', url: '', publishedAt: '2026-01-02', source: '測試' },
      { title: '新聞3', description: '', url: '', publishedAt: '2026-01-03', source: '測試' },
    ])

    const result = await getLatestNews(2)

    expect(result).toHaveLength(2)
    expect(result[0].title).toBe('新聞1')
  })

  it('returns empty array when collectNews yields nothing', async () => {
    vi.mocked(collectNews).mockResolvedValue([])

    const result = await getLatestNews(5)

    expect(result).toEqual([])
  })
})
