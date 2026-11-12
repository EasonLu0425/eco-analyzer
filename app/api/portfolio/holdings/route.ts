import type { NextRequest } from 'next/server'
import { removeHolding, setHolding } from '@/lib/portfolio-store'
import { guarded, ok, readJson } from '@/lib/portfolio-api'
import { parseTicker } from '@/lib/portfolio'

export const dynamic = 'force-dynamic'

/** Overwrite a holding with what the user typed in (shares + average cost). Cash is unchanged. */
export async function PUT(request: NextRequest) {
  return guarded(request, async () => ok(setHolding(await readJson(request))))
}

export async function DELETE(request: NextRequest) {
  return guarded(request, () => {
    const ticker = parseTicker(request.nextUrl.searchParams.get('ticker'))
    removeHolding(ticker)
    return ok({ ticker })
  })
}
