import type { NextRequest } from 'next/server'
import { adjustCash, getCash, setCash } from '@/lib/portfolio-store'
import { guarded, ok, readJson } from '@/lib/portfolio-api'
import { InputError } from '@/lib/portfolio'

export const dynamic = 'force-dynamic'

async function readField(request: NextRequest, field: 'amount' | 'delta'): Promise<unknown> {
  const body = await readJson(request)
  if (typeof body !== 'object' || body === null) throw new InputError('請求內容必須是物件')
  return (body as Record<string, unknown>)[field]
}

/** Set the budget to an exact amount. */
export async function PUT(request: NextRequest) {
  return guarded(request, async () => {
    setCash(await readField(request, 'amount'))
    return ok({ cash: getCash() })
  })
}

/** Add (positive) or remove (negative) budget. */
export async function POST(request: NextRequest) {
  return guarded(request, async () => ok({ cash: adjustCash(await readField(request, 'delta')) }))
}
