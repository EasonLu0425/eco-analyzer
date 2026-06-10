import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { runBacktest } from '@/lib/backtest'
import type { ApiResponse, BacktestResult, ETFSignal } from '@/types'

export const dynamic = 'force-dynamic'

type ReportRow = { date: string; signal: string }
type PriceRow  = { date: string; close: number }

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get('ticker')
  if (!ticker) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, data: null, error: 'ticker 參數必填' },
      { status: 400 },
    )
  }

  const db = getDb()

  const reports = db
    .prepare('SELECT date, signal FROM reports ORDER BY date ASC')
    .all() as ReportRow[]

  const priceRows = db
    .prepare('SELECT date, close FROM prices WHERE ticker = ? ORDER BY date ASC')
    .all(ticker) as PriceRow[]

  if (priceRows.length === 0) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, data: null, error: '無價格資料' },
      { status: 404 },
    )
  }

  const prices = new Map(priceRows.map(r => [r.date, r.close]))
  const result = runBacktest(
    reports as { date: string; signal: ETFSignal }[],
    prices,
    ticker,
  )

  return NextResponse.json<ApiResponse<BacktestResult>>({
    success: true,
    data: result,
    error: null,
  })
}
