import { EVENTS } from '../data/timeline.js'

// A card is "next up" once it's this close to becoming active (spec §6.3).
export const NEXT_UP_WINDOW_SECONDS = 60
// Beyond this, a future card collapses to compact/detail-hidden (spec §6.3).
export const FAR_FUTURE_SECONDS = 30 * 60

// The 9 phase === 'totality' events plus the c3 filter-on card (spec §6.3):
// together they must render as a single compact block, fully visible with
// no scroll, from C2 onward. EVENTS is already authored in this order.
export const TOTALITY_BLOCK_IDS = [
  'c2',
  'burst-1',
  'earth-1',
  'burst-2',
  'earth-2',
  'lookup',
  'burst-3',
  'earth-3',
  'arm-c3',
  'c3',
]
export const TOTALITY_BLOCK_ID_SET = new Set(TOTALITY_BLOCK_IDS)
export const TOTALITY_BLOCK_EVENTS = EVENTS.filter((event) => TOTALITY_BLOCK_ID_SET.has(event.id))

/**
 * Maps an event to its state-styling enum (spec §6.3), using the boundary
 * membership useTimelineState already computed (pastEventIds) rather than
 * re-deriving past/future from timestamps.
 */
export function deriveEventState(event, { activeEvent, nextEvent, pastEventIds, now }) {
  if (activeEvent && event.id === activeEvent.id) {
    return 'active'
  }
  if (pastEventIds.has(event.id)) {
    return 'past'
  }

  const secondsAway = (Date.parse(event.at) - now) / 1000
  if (nextEvent && event.id === nextEvent.id && secondsAway <= NEXT_UP_WINDOW_SECONDS) {
    return 'next-up'
  }
  return secondsAway > FAR_FUTURE_SECONDS ? 'future-far' : 'future'
}

/**
 * True from the moment C2 becomes the next (or active) event, through to
 * the moment c3 stops being active (spec §6.3: "all nine simultaneously
 * visible from C2 onward is a hard requirement") — the operator must see
 * the whole totality sequence before it starts and until it's fully handed
 * back off.
 */
export function isTotalityBlockVisible({ activeEvent, nextEvent }) {
  return Boolean(
    (activeEvent && TOTALITY_BLOCK_ID_SET.has(activeEvent.id)) ||
    (nextEvent && TOTALITY_BLOCK_ID_SET.has(nextEvent.id)),
  )
}
