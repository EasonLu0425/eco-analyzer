import { describe, it, expect } from 'vitest'
import { parseSession } from '@/lib/session'

describe('parseSession', () => {
  it('defaults to morning when no argument is given', () => {
    expect(parseSession(undefined)).toBe('morning')
    expect(parseSession('')).toBe('morning')
  })

  it.each(['morning', 'midday', 'close'] as const)('accepts %s', s => {
    expect(parseSession(s)).toBe(s)
  })

  it('accepts the --session=<name> flag form', () => {
    expect(parseSession('--session=midday')).toBe('midday')
  })

  it('trims whitespace and ignores case', () => {
    expect(parseSession('  Close ')).toBe('close')
  })

  it('throws on an unknown session', () => {
    expect(() => parseSession('evening')).toThrow(/unknown session/i)
  })
})
