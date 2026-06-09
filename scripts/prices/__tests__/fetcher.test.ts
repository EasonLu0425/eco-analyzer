import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('yahoo-finance2', () => ({
  default: {
    historical: vi.fn(),
  },
}))

import yahooFinance from 'yahoo-finance2'
import { fetchPriceData } from '../fetcher'

const mockHistorical = vi.mocked(yahooFinance.historical)

describe('fetchPriceData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns normalized PriceRecord array from yahoo-finance2', async () => {
    mockHistorical.mockResolvedValueOnce([
      { date: new Date('2026-06-09'), open: 45.2, high: 46.1, low: 44.8, close: 45.9, adjClose: 45.9, volume: 1234567 },
      { date: new Date('2026-06-08'), open: 44.5, high: 45.3, low: 44.0, close: 44.9, adjClose: 44.9, volume: 987654 },
    ])

    const result = await fetchPriceData('00662.TW', new Date('2026-06-08'), new Date('2026-06-09'))

    expect(result).toHaveLength(2)
    // ascending sort: Jun8 < Jun9, so Jun8 is at index 0
    expect(result[0]).toEqual({
      date: '2026-06-08',
      open: 44.5,
      high: 45.3,
      low: 44.0,
      close: 44.9,
      volume: 987654,
    })
    expect(result[1].date).toBe('2026-06-09')
  })

  it('sorts results by date ascending', async () => {
    mockHistorical.mockResolvedValueOnce([
      { date: new Date('2026-06-09'), open: 45, high: 46, low: 44, close: 45, adjClose: 45, volume: 100 },
      { date: new Date('2026-06-07'), open: 43, high: 44, low: 42, close: 43, adjClose: 43, volume: 80 },
      { date: new Date('2026-06-08'), open: 44, high: 45, low: 43, close: 44, adjClose: 44, volume: 90 },
    ])

    const result = await fetchPriceData('QQQ', new Date('2026-06-07'), new Date('2026-06-09'))

    expect(result[0].date).toBe('2026-06-07')
    expect(result[1].date).toBe('2026-06-08')
    expect(result[2].date).toBe('2026-06-09')
  })

  it('defaults to 0 when yahoo-finance2 returns null fields', async () => {
    mockHistorical.mockResolvedValueOnce([
      { date: new Date('2026-06-09'), open: null, high: null, low: null, close: null, adjClose: null, volume: null },
    ] as never)

    const result = await fetchPriceData('QQQ', new Date('2026-06-09'), new Date('2026-06-09'))

    expect(result[0]).toEqual({ date: '2026-06-09', open: 0, high: 0, low: 0, close: 0, volume: 0 })
  })

  it('returns empty array when yahoo-finance2 returns no data', async () => {
    mockHistorical.mockResolvedValueOnce([])

    const result = await fetchPriceData('QQQ', new Date('2026-06-01'), new Date('2026-06-09'))

    expect(result).toEqual([])
  })

  it('throws when yahoo-finance2 rejects', async () => {
    mockHistorical.mockRejectedValueOnce(new Error('Network error'))

    await expect(
      fetchPriceData('QQQ', new Date('2026-06-01'), new Date('2026-06-09'))
    ).rejects.toThrow('Network error')
  })
})
