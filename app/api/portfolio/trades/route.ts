import type { NextRequest } from 'next/server'
import { recordTrade } from '@/lib/portfolio-store'
import { guarded, ok, readJson } from '@/lib/portfolio-api'

export const dynamic = 'force-dynamic'

/** Record a buy or sell: updates the holding, the cash budget and the trade log in one step. */
export async function POST(request: NextRequest) {
  return guarded(request, async () => ok(recordTrade(await readJson(request)), 201))
}
