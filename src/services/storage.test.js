import { beforeEach, describe, expect, it } from 'vitest'
import { getItem, setItem } from './storage.js'

describe('storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('round-trips a value through setItem and getItem', () => {
    setItem('eclipse.test', { a: 1, b: [2, 3] })

    expect(getItem('eclipse.test', null)).toEqual({ a: 1, b: [2, 3] })
  })

  it('returns the fallback when the key is missing', () => {
    expect(getItem('eclipse.missing', 'fallback')).toBe('fallback')
  })

  it('returns the fallback rather than throwing when persisted data is malformed', () => {
    localStorage.setItem('eclipse.broken', '{not valid json')

    expect(() => getItem('eclipse.broken', 'fallback')).not.toThrow()
    expect(getItem('eclipse.broken', 'fallback')).toBe('fallback')
  })
})
