import { describe, expect, it } from 'vitest'
import { EVENTS } from './timeline.js'

describe('EVENTS', () => {
  it('contains exactly 26 events', () => {
    expect(EVENTS).toHaveLength(26)
  })

  it('is strictly ordered by "at" with no duplicate ids or times', () => {
    const ids = new Set()
    const times = new Set()

    for (let i = 0; i < EVENTS.length; i++) {
      const event = EVENTS[i]

      expect(ids.has(event.id)).toBe(false)
      ids.add(event.id)

      expect(times.has(event.at)).toBe(false)
      times.add(event.at)

      if (i > 0) {
        const previous = EVENTS[i - 1]
        expect(new Date(event.at).getTime()).toBeGreaterThan(new Date(previous.at).getTime())
      }
    }
  })

  it('parses every "at" field to a valid date on 2026-08-12 UTC', () => {
    for (const event of EVENTS) {
      const parsed = new Date(event.at)

      expect(parsed.toString()).not.toBe('Invalid Date')
      expect(parsed.getUTCFullYear()).toBe(2026)
      expect(parsed.getUTCMonth()).toBe(7) // August, zero-indexed
      expect(parsed.getUTCDate()).toBe(12)
    }
  })
})
