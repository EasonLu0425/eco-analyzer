import { NextRequest, NextResponse } from 'next/server'
import { getLatestReport, getReportByDate, getReports } from '@/lib/file-store'
import type { ApiResponse, PaginatedReports, AnalysisReport } from '@/types'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const date   = searchParams.get('date')
  const page   = parseInt(searchParams.get('page') ?? '1')
  const limit  = Math.min(parseInt(searchParams.get('limit') ?? '30'), 100)
  const latest = searchParams.get('latest') === 'true'

  if (date) {
    const report = getReportByDate(date)
    if (!report) return NextResponse.json<ApiResponse<null>>({ success: false, data: null, error: '找不到該日期的報告' }, { status: 404 })
    return NextResponse.json<ApiResponse<AnalysisReport>>({ success: true, data: report, error: null })
  }

  if (latest) {
    const report = getLatestReport()
    return NextResponse.json<ApiResponse<AnalysisReport | null>>({ success: true, data: report, error: null })
  }

  const { reports, total } = getReports(page, limit)
  return NextResponse.json<ApiResponse<PaginatedReports>>({
    success: true,
    data: { reports, total, page, limit },
    error: null,
  })
}
