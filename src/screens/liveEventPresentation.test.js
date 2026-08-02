import { describe, expect, it } from 'vitest'
import { EVENTS } from '../data/timeline.js'
import { findActiveEvent } from '../hooks/useTimelineState.js'
import {
  deriveEventState,
  isTotalityBlockVisible,
  NEXT_UP_WINDOW_SECONDS,
  FAR_FUTURE_SECONDS,
  TOTALITY_BLOCK_IDS,
} from './liveEventPresentation.js'

const toMs = (iso) => Date.parse(iso)
const NOW_MS = Date.parse('2026-08-12T00:00:00Z')

function eventSecondsAway(secondsAway) {
  return { id: 'future-event', at: new Date(NOW_MS + secondsAway * 1000).toISOString() }
}

describe('deriveEventState', () => {
  it('is "active" for the active event, regardless of any other condition', () => {
    const event = eventSecondsAway(0)
    const state = deriveEventState(event, {
      activeEvent: event,
      nextEvent: null,
      pastEventIds: new Set([event.id]),
      now: NOW_MS,
    })

    expect(state).toBe('active')
  })

  it('is "past" for an event in pastEventIds (and not the active event)', () => {
    const event = eventSecondsAway(-10)
    const state = deriveEventState(event, {
      activeEvent: { id: 'something-else' },
      nextEvent: null,
      pastEventIds: new Set([event.id]),
      now: NOW_MS,
    })

    expect(state).toBe('past')
  })

  it('is "next-up" at exactly the 60s boundary, and "future" one tick past it', () => {
    const atBoundary = eventSecondsAway(NEXT_UP_WINDOW_SECONDS)
    const justBeyond = eventSecondsAway(NEXT_UP_WINDOW_SECONDS + 1)
    const context = (event) => ({
      activeEvent: null,
      nextEvent: event,
      pastEventIds: new Set(),
      now: NOW_MS,
    })

    expect(deriveEventState(atBoundary, context(atBoundary))).toBe('next-up')
    expect(deriveEventState(justBeyond, context(justBeyond))).toBe('future')
  })

  it('marks only THE next event next-up — a different future event inside the 60s window stays "future"', () => {
    // Kills the surviving deriveEventState mutants that drop the
    // nextEvent-identity check: with it gone, ANY future event inside the
    // window would light up as next-up alongside the real one.
    const next = eventSecondsAway(30)
    const alsoSoon = { id: 'different-event', at: new Date(NOW_MS + 50 * 1000).toISOString() }
    const context = {
      activeEvent: null,
      nextEvent: next,
      pastEventIds: new Set(),
      now: NOW_MS,
    }

    expect(deriveEventState(next, context)).toBe('next-up')
    expect(deriveEventState(alsoSoon, context)).toBe('future')
  })

  it('is "future" inside the 60s window when there is no next event at all', () => {
    const soon = eventSecondsAway(30)
    const context = { activeEvent: null, nextEvent: null, pastEventIds: new Set(), now: NOW_MS }

    expect(deriveEventState(soon, context)).toBe('future')
  })

  it('is "future" at exactly the 30-minute far-future boundary, and "future-far" one tick beyond it', () => {
    const atBoundary = eventSecondsAway(FAR_FUTURE_SECONDS)
    const justBeyond = eventSecondsAway(FAR_FUTURE_SECONDS + 1)
    const context = {
      activeEvent: null,
      nextEvent: null,
      pastEventIds: new Set(),
      now: NOW_MS,
    }

    expect(deriveEventState(atBoundary, context)).toBe('future')
    expect(deriveEventState(justBeyond, context)).toBe('future-far')
  })
})

describe('isTotalityBlockVisible boundary transitions', () => {
  it('is hidden 1ms before final-check fires, and visible at the exact instant it does (c2 becomes next)', () => {
    const finalCheckAt = toMs('2026-08-12T17:45:40Z')

    const before = findActiveEvent(EVENTS, finalCheckAt - 1)
    expect(isTotalityBlockVisible(before)).toBe(false)

    const atBoundary = findActiveEvent(EVENTS, finalCheckAt)
    expect(atBoundary.nextEvent.id).toBe('c2')
    expect(isTotalityBlockVisible(atBoundary)).toBe(true)
  })

  it('is still visible 1ms before c3 stops being active, and hidden at the exact instant ramp-down-1 becomes active', () => {
    const rampDown1At = toMs('2026-08-12T17:49:15Z')

    const before = findActiveEvent(EVENTS, rampDown1At - 1)
    expect(before.activeEvent.id).toBe('c3')
    expect(isTotalityBlockVisible(before)).toBe(true)

    const atBoundary = findActiveEvent(EVENTS, rampDown1At)
    expect(atBoundary.activeEvent.id).toBe('ramp-down-1')
    expect(isTotalityBlockVisible(atBoundary)).toBe(false)
  })

  it('is visible for every instant spanning the full totality block, first event to last', () => {
    const firstAt = toMs(EVENTS.find((event) => event.id === TOTALITY_BLOCK_IDS[0]).at)
    const lastAt = toMs(EVENTS.find((event) => event.id === TOTALITY_BLOCK_IDS.at(-1)).at)

    expect(isTotalityBlockVisible(findActiveEvent(EVENTS, firstAt))).toBe(true)
    expect(isTotalityBlockVisible(findActiveEvent(EVENTS, lastAt))).toBe(true)
    expect(
      isTotalityBlockVisible(findActiveEvent(EVENTS, Math.round((firstAt + lastAt) / 2))),
    ).toBe(true)
  })
})
