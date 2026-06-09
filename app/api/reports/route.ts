import { NextRequest, NextResponse } from 'next/server'
import { getDb, rowToReport } from '@/lib/db'
import type { ApiResponse, PaginatedReports, AnalysisReport } from '@/types'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const date   = searchParams.get('date')
  const page   = parseInt(searchParams.get('page') ?? '1')
  const limit  = Math.min(parseInt(searchParams.get('limit') ?? '30'), 100)
  const latest = searchParams.get('latest') === 'true'

  const db = getDb()

  if (date) {
    const row = db.prepare('SELECT * FROM reports WHERE date = ?').get(date) as Row | undefined
    if (!row) return NextResponse.json<ApiResponse<null>>({ success: false, data: null, error: '找不到該日期的報告' }, { status: 404 })
    return NextResponse.json<ApiResponse<AnalysisReport>>({ success: true, data: rowToReport(row), error: null })
  }

  if (latest) {
    const row = db.prepare('SELECT * FROM reports ORDER BY date DESC LIMIT 1').get() as Row | undefined
    return NextResponse.json<ApiResponse<AnalysisReport | null>>({ success: true, data: row ? rowToReport(row) : null, error: null })
  }

  const offset = (page - 1) * limit
  const total  = (db.prepare('SELECT COUNT(*) as count FROM reports').get() as { count: number }).count
  const rows   = db.prepare('SELECT * FROM reports ORDER BY date DESC LIMIT ? OFFSET ?').all(limit, offset) as Row[]

  return NextResponse.json<ApiResponse<PaginatedReports>>({
    success: true,
    data: { reports: rows.map(rowToReport), total, page, limit },
    error: null,
  })
}

type Row = Record<string, unknown>
