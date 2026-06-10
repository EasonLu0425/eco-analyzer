import { NextRequest, NextResponse } from 'next/server'
import { getPriceHistory } from '@/lib/price-store'
import { computeIndicators } from '@/lib/indicators'
import type { ApiResponse, TechnicalIndicators } from '@/types'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get('ticker')
  if (!ticker) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, data: null, error: 'ticker 參數必填' },
      { status: 400 },
    )
  }

  const records = getPriceHistory(ticker, 90)
  if (records.length === 0) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, data: null, error: '無價格資料' },
      { status: 404 },
    )
  }

  const indicators = computeIndicators(records, ticker)
  return NextResponse.json<ApiResponse<TechnicalIndicators[]>>({
    success: true,
    data: indicators,
    error: null,
  })
}
