import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import type { PriceRecord } from '@/types'

vi.mock('../fetcher', () => ({
  fetchPriceData: vi.fn(),
}))

import { fetchPriceData } from '../fetcher'
import { updatePrices, TICKERS } from '../index'

const mockFetch = vi.mocked(fetchPriceData)
const TEST_DIR = join(process.cwd(), 'data', 'prices-test')

const makeRecord = (date: string, close = 100): PriceRecord => ({
  date,
  open: close - 1,
  high: close + 1,
  low: close - 2,
  close,
  volume: 500000,
})

describe('updatePrices', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true })
    mkdirSync(TEST_DIR, { recursive: true })
  })

  it('bootstrap: fetches ~365 days when price file does not exist', async () => {
    mockFetch.mockResolvedValue([makeRecord('2026-06-09')])

    await updatePrices(TEST_DIR)

    expect(mockFetch).toHaveBeenCalledTimes(TICKERS.length)
    const [, fromDate] = mockFetch.mock.calls[0] as [string, Date, Date]
    const daysDiff = Math.round((Date.now() - fromDate.getTime()) / 86400000)
    expect(daysDiff).toBeGreaterThanOrEqual(360)
    expect(daysDiff).toBeLessThanOrEqual(370)
  })

  it('incremental: fetches only from lastDate+1 when file already exists', async () => {
    const existing: PriceRecord[] = [makeRecord('2026-06-07'), makeRecord('2026-06-08')]
    writeFileSync(join(TEST_DIR, '00662.TW.json'), JSON.stringify(existing))

    mockFetch.mockResolvedValue([makeRecord('2026-06-09')])

    await updatePrices(TEST_DIR)

    const [, fromDate] = mockFetch.mock.calls[0] as [string, Date, Date]
    expect(fromDate.toISOString().slice(0, 10)).toBe('2026-06-09')
  })

  it('appends new records to existing file without duplicates', async () => {
    const existing: PriceRecord[] = [makeRecord('2026-06-07'), makeRecord('2026-06-08')]
    writeFileSync(join(TEST_DIR, '00662.TW.json'), JSON.stringify(existing))

    mockFetch.mockResolvedValue([makeRecord('2026-06-09', 102)])

    await updatePrices(TEST_DIR)

    const saved: PriceRecord[] = JSON.parse(readFileSync(join(TEST_DIR, '00662.TW.json'), 'utf-8'))
    expect(saved).toHaveLength(3)
    expect(saved[2].date).toBe('2026-06-09')
    expect(saved[2].close).toBe(102)
  })

  it('skips write when fetchPriceData returns empty (no new data)', async () => {
    const existing: PriceRecord[] = [makeRecord('2026-06-09')]
    writeFileSync(join(TEST_DIR, '00662.TW.json'), JSON.stringify(existing))

    mockFetch.mockResolvedValue([])

    await updatePrices(TEST_DIR)

    const saved: PriceRecord[] = JSON.parse(readFileSync(join(TEST_DIR, '00662.TW.json'), 'utf-8'))
    expect(saved).toHaveLength(1)
  })

  it('continues with other tickers when one ticker fetch fails', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('rate limited'))
      .mockResolvedValue([makeRecord('2026-06-09')])

    await expect(updatePrices(TEST_DIR)).resolves.not.toThrow()
    expect(mockFetch).toHaveBeenCalledTimes(TICKERS.length)
  })
})
