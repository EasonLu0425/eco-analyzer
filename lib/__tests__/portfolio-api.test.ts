import { describe, it, expect, afterEach } from 'vitest'
import { isAllowedHost, isSameOrigin, readJson, MAX_BODY_CHARS } from '@/lib/portfolio-api'
import { InputError } from '@/lib/portfolio'

const req = (headers: Record<string, string>) => ({ headers: new Headers(headers) })
const body = (text: string) => ({ text: async () => text })

afterEach(() => {
  delete process.env.PORTFOLIO_ALLOWED_HOSTS
})

describe('isAllowedHost', () => {
  it.each(['localhost:3000', 'localhost', '127.0.0.1:3001', '[::1]:3000'])('allows loopback host %s', host => {
    expect(isAllowedHost(host)).toBe(true)
  })

  it.each([null, '', 'evil.com:3000', '192.168.1.5:3000', 'localhost.evil.com', '127.0.0.1.evil.com:3000'])(
    'rejects %j (DNS rebinding / LAN)', host => {
      expect(isAllowedHost(host)).toBe(false)
    },
  )

  it('allows extra hosts listed in PORTFOLIO_ALLOWED_HOSTS', () => {
    process.env.PORTFOLIO_ALLOWED_HOSTS = 'nas.local:3000, 192.168.1.5:3000'
    expect(isAllowedHost('nas.local:3000')).toBe(true)
    expect(isAllowedHost('192.168.1.5:3000')).toBe(true)
    expect(isAllowedHost('evil.com')).toBe(false)
  })
})

describe('isSameOrigin', () => {
  it('accepts a matching loopback origin and host', () => {
    expect(isSameOrigin(req({ origin: 'http://localhost:3000', host: 'localhost:3000' }))).toBe(true)
  })

  it('accepts non-browser clients that send no Origin', () => {
    expect(isSameOrigin(req({ host: 'localhost:3000' }))).toBe(true)
  })

  it('rejects a cross-site origin', () => {
    expect(isSameOrigin(req({ origin: 'http://evil.example', host: 'localhost:3000' }))).toBe(false)
  })

  it('rejects a rebound host even when origin and host match each other', () => {
    expect(isSameOrigin(req({ origin: 'http://evil.com:3000', host: 'evil.com:3000' }))).toBe(false)
  })

  it('rejects the literal "null" origin and malformed origins', () => {
    expect(isSameOrigin(req({ origin: 'null', host: 'localhost:3000' }))).toBe(false)
    expect(isSameOrigin(req({ origin: '::::', host: 'localhost:3000' }))).toBe(false)
  })
})

describe('readJson', () => {
  it('parses a small JSON body', async () => {
    expect(await readJson(body('{"amount":5}'))).toEqual({ amount: 5 })
  })

  it('rejects invalid JSON with an InputError', async () => {
    await expect(readJson(body('{bad'))).rejects.toBeInstanceOf(InputError)
  })

  it('rejects an oversized body before parsing it', async () => {
    await expect(readJson(body(`{"x":"${'a'.repeat(MAX_BODY_CHARS)}"}`))).rejects.toThrow(/過大/)
  })
})
