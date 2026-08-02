import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EVENTS } from '../data/timeline.js'
import { findActiveEvent, useTimelineState } from './useTimelineState.js'

const toMs = (iso) => Date.parse(iso)

// Table-driven scenarios from plans/eclipse-timer.md Slice 3 Step 3.2's
// Scenario Outline (spec §13 item 4): before C1, mid-partial-1, during
// handover, each totality step, and after C4.
//
// Two "now" instants are corrected from the plan's literal table against
// the real EVENTS data committed in Slice 1 (src/data/timeline.js), which
// matches eclipse-timer-spec.md verbatim:
//   - row 1: the plan's now of 16:00:00Z falls 15 minutes AFTER the
//     "setup" event (15:45:00Z), so a correct boundary search would report
//     active="setup", not "none" as the plan's table states. Moved to
//     15:00:00Z (genuinely before the first event) to match the table's
//     stated active=none/next=setup/filterOn=true intent.
//   - row 4: the plan's now of 17:46:20Z falls AFTER "burst-1" (17:46:15Z),
//     so a correct boundary search would report active="burst-1", not "c2"
//     as the plan's table states. Moved to 17:46:12Z (between c2's
//     17:46:10Z and burst-1's 17:46:15Z) to match the table's stated
//     active=c2/next=burst-1/filterOn=false intent.
// Both corrections preserve the plan's intended active/next/filterOn
// values; only the "now" instant was adjusted to be reachable by a
// correctly-implemented boundary search. The other five rows are verbatim.
const scenarios = [
  ['2026-08-12T15:00:00Z', null, 'setup', true],
  ['2026-08-12T16:50:00Z', 'c1', 'check-1', true],
  ['2026-08-12T17:43:00Z', 'handover-in', 'ramp-full', true],
  ['2026-08-12T17:46:12Z', 'c2', 'burst-1', false],
  ['2026-08-12T17:47:20Z', 'lookup', 'burst-4', false],
  ['2026-08-12T17:48:20Z', 'c3', 'ramp-down-1', true],
  ['2026-08-12T18:50:00Z', 'c4', null, true],
]

describe('findActiveEvent', () => {
  it.each(scenarios)(
    'now=%s -> active=%s, next=%s, filterOn=%s',
    (now, activeId, nextId, filterOn) => {
      const { activeEvent, nextEvent } = findActiveEvent(EVENTS, toMs(now))

      expect(activeEvent?.id ?? null).toBe(activeId)
      expect(nextEvent?.id ?? null).toBe(nextId)
      expect(activeEvent ? activeEvent.filterOn : true).toBe(filterOn)
    },
  )

  it('reports no past events and every event as upcoming before the timeline starts', () => {
    const { pastEvents, upcomingEvents } = findActiveEvent(EVENTS, toMs('2026-08-12T15:00:00Z'))

    expect(pastEvents).toEqual([])
    expect(upcomingEvents).toHaveLength(EVENTS.length)
  })

  it('reports every event as past and no upcoming events after the timeline ends', () => {
    const { pastEvents, upcomingEvents } = findActiveEvent(EVENTS, toMs('2026-08-12T18:50:00Z'))

    expect(pastEvents).toHaveLength(EVENTS.length - 1)
    expect(upcomingEvents).toEqual([])
  })

  it('handles an empty events array without an out-of-range read', () => {
    expect(findActiveEvent([], toMs('2026-08-12T17:00:00Z'))).toEqual({
      activeEvent: null,
      nextEvent: null,
      pastEvents: [],
      upcomingEvents: [],
    })
  })

  it('returns correct active/next events after the same array reference is resized', () => {
    const events = EVENTS.slice(0, 3)

    // First call caches 3 parsed timestamps under this array's reference.
    findActiveEvent(events, toMs('2026-08-12T15:00:00Z'))

    // Resizing the same reference must invalidate the cache rather than
    // reuse a parsed-timestamps array shorter than the new length.
    events.push(EVENTS[3])

    const { activeEvent, nextEvent } = findActiveEvent(events, toMs(EVENTS[3].at))

    expect(activeEvent?.id).toBe(EVENTS[3].id)
    expect(nextEvent).toBeNull()
  })
})

describe('useTimelineState', () => {
  it('returns filterOn true and no active event before any event has started', () => {
    const { result } = renderHook(() => useTimelineState(toMs('2026-08-12T15:00:00Z'), EVENTS))

    expect(result.current.activeEvent).toBeNull()
    expect(result.current.nextEvent.id).toBe('setup')
    expect(result.current.filterOn).toBe(true)
  })

  it('derives filterOn from the active event once the timeline is underway', () => {
    const { result } = renderHook(() => useTimelineState(toMs('2026-08-12T17:46:12Z'), EVENTS))

    expect(result.current.activeEvent.id).toBe('c2')
    expect(result.current.nextEvent.id).toBe('burst-1')
    expect(result.current.filterOn).toBe(false)
  })

  it('reports no next event after the last event has fired', () => {
    const { result } = renderHook(() => useTimelineState(toMs('2026-08-12T18:50:00Z'), EVENTS))

    expect(result.current.activeEvent.id).toBe('c4')
    expect(result.current.nextEvent).toBeNull()
  })
})

describe('findActiveEvent clock-offset boundary shift', () => {
  it('shifts the active-event boundary earlier by exactly the applied offset', () => {
    const boundary = toMs('2026-08-12T16:47:00Z') // c1's "at"
    const offsetMs = 3000
    const threeSecondsBeforeBoundary = boundary - offsetMs

    // At the instant exactly 3s before the boundary, un-offset "now" has
    // not yet crossed it — still the previous event (arm).
    expect(findActiveEvent(EVENTS, threeSecondsBeforeBoundary).activeEvent.id).toBe('arm')

    // Applying the +3000ms offset to that same instant lands exactly ON
    // the boundary, so the active event has already advanced to c1 — the
    // boundary crossed exactly 3 seconds earlier than it would unoffset.
    expect(findActiveEvent(EVENTS, threeSecondsBeforeBoundary + offsetMs).activeEvent.id).toBe('c1')

    // One millisecond earlier still (3001ms before the boundary), even
    // with the offset applied, the crossing has not yet happened — pinning
    // the shift to EXACTLY 3000ms, not "at least" 3000ms.
    expect(findActiveEvent(EVENTS, threeSecondsBeforeBoundary - 1 + offsetMs).activeEvent.id).toBe(
      'arm',
    )
  })
})
