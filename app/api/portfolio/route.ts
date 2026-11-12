import type { NextRequest } from 'next/server'
import { getAllocationAdvice } from '@/lib/allocation-advice'
import { getPortfolio, getTrades } from '@/lib/portfolio-store'
import { fail, guardRead, ok } from '@/lib/portfolio-api'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const denied = guardRead(request)
  if (denied) return denied
  try {
    return ok({ ...getPortfolio(), trades: getTrades(50), allocation: getAllocationAdvice() })
  } catch (err) {
    console.error('[portfolio api]', err)
    return fail('伺服器錯誤', 500)
  }
}
