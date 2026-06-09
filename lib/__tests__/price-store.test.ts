import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import type { PriceRecord } from '@/types'

const TEST_DIR = join(process.cwd(), 'data', 'prices-test-store')

function makeHistory(days: number, endDateStr: string, baseClose = 100): PriceRecord[] {
  const records: PriceRecord[] = []
  const end = new Date(endDateStr)
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end)
    d.setDate(d.getDate() - i)
    records.push({
      date: d.toISOString().slice(0, 10),
      open: baseClose - 1,
      high: baseClose + 2,
      low: baseClose - 3,
      close: baseClose + (days - 1 - i) * 0.1,
      volume: 100000,
    })
  }
  return records
}

describe('getPriceHistory', () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true })
    mkdirSync(TEST_DIR, { recursive: true })
  })
  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true })
  })

  it('returns last N days of records sorted ascending', async () => {
    const records = makeHistory(200, '2026-06-09')
    writeFileSync(join(TEST_DIR, 'QQQ.json'), JSON.stringify(records))

    const { getPriceHistory } = await import('../price-store')
    const result = getPriceHistory('QQQ', 30, TEST_DIR)

    expect(result).toHaveLength(30)
    expect(result[0].date < result[29].date).toBe(true)
  })

  it('returns all records when requested days exceeds file length', async () => {
    const records = makeHistory(10, '2026-06-09')
    writeFileSync(join(TEST_DIR, 'QQQ.json'), JSON.stringify(records))

    const { getPriceHistory } = await import('../price-store')
    const result = getPriceHistory('QQQ', 90, TEST_DIR)

    expect(result).toHaveLength(10)
  })

  it('returns empty array when file does not exist', async () => {
    const { getPriceHistory } = await import('../price-store')
    const result = getPriceHistory('MISSING', 30, TEST_DIR)

    expect(result).toEqual([])
  })

  it('returns empty array when file contains invalid JSON', async () => {
    writeFileSync(join(TEST_DIR, 'CORRUPT.json'), 'not-valid-json')

    const { getPriceHistory } = await import('../price-store')
    const result = getPriceHistory('CORRUPT', 30, TEST_DIR)

    expect(result).toEqual([])
  })
})

describe('getPriceTrend', () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true })
    mkdirSync(TEST_DIR, { recursive: true })
  })
  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true })
  })

  it('calculates 30d and 90d change correctly', async () => {
    const records = makeHistory(120, '2026-06-09', 90)
    writeFileSync(join(TEST_DIR, 'QQQ.json'), JSON.stringify(records))

    const { getPriceTrend } = await import('../price-store')
    const trend = getPriceTrend('QQQ', TEST_DIR)

    expect(trend).not.toBeNull()
    expect(trend!.currentClose).toBeTypeOf('number')
    expect(trend!.change30d).toBeTypeOf('number')
    expect(trend!.change90d).toBeTypeOf('number')
  })

  it('includes 52-week high and low', async () => {
    const records = makeHistory(365, '2026-06-09', 50)
    records[100].high = 200
    records[200].low = 10
    writeFileSync(join(TEST_DIR, 'QQQ.json'), JSON.stringify(records))

    const { getPriceTrend } = await import('../price-store')
    const trend = getPriceTrend('QQQ', TEST_DIR)

    expect(trend!.high52w).toBe(200)
    expect(trend!.low52w).toBe(10)
  })

  it('returns null when fewer than 31 records', async () => {
    const records = makeHistory(5, '2026-06-09')
    writeFileSync(join(TEST_DIR, 'QQQ.json'), JSON.stringify(records))

    const { getPriceTrend } = await import('../price-store')
    const trend = getPriceTrend('QQQ', TEST_DIR)

    expect(trend).toBeNull()
  })
})
