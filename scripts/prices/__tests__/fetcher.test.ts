import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockChart = vi.hoisted(() => vi.fn())
const mockQuote = vi.hoisted(() => vi.fn())

vi.mock('yahoo-finance2', () => ({
  default: class {
    chart = mockChart
    quote = mockQuote
  },
}))

import { fetchPriceData, fetchQuote } from '../fetcher'

const bar = (date: string, close: number, volume = 100) => ({
  date: new Date(date),
  open: close - 1,
  high: close + 1,
  low: close - 2,
  close,
  volume,
})

describe('fetchPriceData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns normalized PriceRecord array from yahoo-finance2', async () => {
    mockChart.mockResolvedValueOnce({
      quotes: [
        { date: new Date('2026-06-09'), open: 45.2, high: 46.1, low: 44.8, close: 45.9, volume: 1234567 },
        { date: new Date('2026-06-08'), open: 44.5, high: 45.3, low: 44.0, close: 44.9, volume: 987654 },
      ],
    })

    const result = await fetchPriceData('00662.TW', new Date('2026-06-08'), new Date('2026-06-09'))

    expect(result).toHaveLength(2)
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
    mockChart.mockResolvedValueOnce({
      quotes: [bar('2026-06-09', 45), bar('2026-06-07', 43), bar('2026-06-08', 44)],
    })

    const result = await fetchPriceData('QQQ', new Date('2026-06-07'), new Date('2026-06-09'))

    expect(result.map(r => r.date)).toEqual(['2026-06-07', '2026-06-08', '2026-06-09'])
  })

  it('drops bars whose OHLC fields are null (e.g. a day with no trading yet)', async () => {
    mockChart.mockResolvedValueOnce({
      quotes: [
        { date: new Date('2026-06-09'), open: null, high: null, low: null, close: null, volume: null },
        bar('2026-06-08', 44),
      ],
    })

    const result = await fetchPriceData('QQQ', new Date('2026-06-08'), new Date('2026-06-09'))

    expect(result.map(r => r.date)).toEqual(['2026-06-08'])
  })

  it('defaults volume to 0 when it is null', async () => {
    mockChart.mockResolvedValueOnce({
      quotes: [{ date: new Date('2026-06-09'), open: 1, high: 2, low: 1, close: 2, volume: null }],
    })

    const result = await fetchPriceData('QQQ', new Date('2026-06-09'), new Date('2026-06-09'))

    expect(result[0].volume).toBe(0)
  })

  it('returns empty array when yahoo-finance2 returns no data', async () => {
    mockChart.mockResolvedValueOnce({ quotes: [] })

    expect(await fetchPriceData('QQQ', new Date('2026-06-01'), new Date('2026-06-09'))).toEqual([])
  })

  it('throws when yahoo-finance2 rejects', async () => {
    mockChart.mockRejectedValueOnce(new Error('Network error'))

    await expect(
      fetchPriceData('QQQ', new Date('2026-06-01'), new Date('2026-06-09')),
    ).rejects.toThrow('Network error')
  })
})

describe('fetchQuote', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('maps a yahoo quote to an IntradayQuote', async () => {
    mockQuote.mockResolvedValueOnce({
      regularMarketPrice: 98.5,
      regularMarketOpen: 99,
      regularMarketDayHigh: 100,
      regularMarketDayLow: 97.8,
      regularMarketVolume: 12345,
      regularMarketPreviousClose: 100.2,
      regularMarketTime: new Date('2026-11-06T03:00:00.000Z'),
    })

    const q = await fetchQuote('0050.TW')

    expect(q).toEqual({
      ticker: '0050.TW',
      price: 98.5,
      open: 99,
      high: 100,
      low: 97.8,
      volume: 12345,
      prevClose: 100.2,
      marketTime: '2026-11-06T03:00:00.000Z',
    })
  })

  it('returns null when there is no market price', async () => {
    mockQuote.mockResolvedValueOnce({ regularMarketPrice: undefined })

    expect(await fetchQuote('0050.TW')).toBeNull()
  })

  it('returns null when yahoo returns nothing', async () => {
    mockQuote.mockResolvedValueOnce(undefined)

    expect(await fetchQuote('0050.TW')).toBeNull()
  })

  it('falls back to price for missing optional fields', async () => {
    mockQuote.mockResolvedValueOnce({
      regularMarketPrice: 50,
      regularMarketTime: new Date('2026-11-06T03:00:00.000Z'),
    })

    const q = await fetchQuote('^TWII')

    expect(q).toMatchObject({ price: 50, open: 50, high: 50, low: 50, volume: 0, prevClose: 50 })
  })

  it('propagates network errors', async () => {
    mockQuote.mockRejectedValueOnce(new Error('rate limited'))

    await expect(fetchQuote('0050.TW')).rejects.toThrow('rate limited')
  })
})
