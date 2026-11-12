/**
 * Shared plumbing for the /api/portfolio routes: same-origin guard for writes,
 * JSON body parsing, and error mapping (user-correctable problems -> 400, anything else -> 500
 * with a generic message so internals are not leaked).
 */
import { NextResponse, type NextRequest } from 'next/server'
import type { ApiResponse } from '@/types'
import { InputError } from './portfolio'

export const ok = <T>(data: T, status = 200): NextResponse =>
  NextResponse.json<ApiResponse<T>>({ success: true, data, error: null }, { status })

export const fail = (error: string, status: number): NextResponse =>
  NextResponse.json<ApiResponse<null>>({ success: false, data: null, error }, { status })

const LOOPBACK_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i

/** Max request body, in characters. Real payloads are well under 200. */
export const MAX_BODY_CHARS = 4096

/**
 * Only loopback Host values (plus any listed in PORTFOLIO_ALLOWED_HOSTS, comma-separated) may use
 * these routes. A DNS-rebinding page gets Host = its own domain, so it is refused even though its
 * Origin and Host agree. Set the env var to reach the app from another device on your network.
 */
export function isAllowedHost(host: string | null): boolean {
  if (!host) return false
  if (LOOPBACK_HOST.test(host)) return true
  const extra = (process.env.PORTFOLIO_ALLOWED_HOSTS ?? '').split(',').map(h => h.trim().toLowerCase()).filter(Boolean)
  return extra.includes(host.toLowerCase())
}

/** Allowed Host, and (browsers send Origin on cross-origin and state-changing requests) Origin must be this same site. */
export function isSameOrigin(request: Pick<NextRequest, 'headers'>): boolean {
  const host = request.headers.get('host')
  if (!isAllowedHost(host)) return false
  const origin = request.headers.get('origin')
  if (origin == null) return true   // non-browser clients (curl, scripts) send none
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

export async function readJson(request: { text: () => Promise<string> }): Promise<unknown> {
  const text = await request.text()
  if (text.length > MAX_BODY_CHARS) throw new InputError('請求內容過大')
  try {
    return JSON.parse(text)
  } catch {
    throw new InputError('請求內容不是有效的 JSON')
  }
}

/** Read-side guard: same Host rule, so a rebinding page cannot read the portfolio either. */
export function guardRead(request: Pick<NextRequest, 'headers'>): NextResponse | null {
  return isAllowedHost(request.headers.get('host')) ? null : fail('不允許的來源', 403)
}

/** Runs a mutation handler behind the origin guard with uniform error mapping. */
export async function guarded(request: NextRequest, run: () => Promise<NextResponse> | NextResponse): Promise<NextResponse> {
  if (!isSameOrigin(request)) return fail('不允許的來源', 403)
  try {
    return await run()
  } catch (err) {
    if (err instanceof InputError) return fail(err.message, 400)
    console.error('[portfolio api]', err)
    return fail('伺服器錯誤', 500)
  }
}
