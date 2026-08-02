/**
 * Derives active/next event and filter state from "now" against the
 * strictly-ordered EVENTS array (src/data/timeline.js's own invariant: 26
 * events, each "at" strictly greater than the previous — enforced by that
 * module's own tests, so this boundary search never needs to defend against
 * an unsorted or duplicate-timestamp input).
 */

// Caches each events array's parsed epoch-ms timestamps by array reference,
// so a stable array (EVENTS is a module-level singleton, called every 250ms
// tick) avoids re-parsing timestamps it has already parsed. Keyed on
// reference identity, so also checks length to invalidate if the same
// reference were ever resized in place (nothing does this today).
const parsedTimestampsCache = new WeakMap()

function parsedTimestampsFor(events) {
  let parsed = parsedTimestampsCache.get(events)
  if (!parsed || parsed.length !== events.length) {
    parsed = events.map((event) => Date.parse(event.at))
    parsedTimestampsCache.set(events, parsed)
  }
  return parsed
}

/**
 * Boundary search — the safety-critical piece of the derivation, extracted
 * so it is testable without mounting a hook (memoizes parsed timestamps by
 * array reference, per the cache note above, so it is not strictly pure).
 * Finds the last event
 * whose `at` is at or before `now` (the "active" event) and the one
 * immediately following it (the "next" event), via binary search since
 * `events` is guaranteed strictly ordered by `at`.
 *
 * @param {import('../data/timeline.js').TimelineEvent[]} events
 * @param {number} now - epoch ms (already offset-adjusted by clockService)
 * @returns {{
 *   activeEvent: import('../data/timeline.js').TimelineEvent | null,
 *   nextEvent: import('../data/timeline.js').TimelineEvent | null,
 *   pastEvents: import('../data/timeline.js').TimelineEvent[],
 *   upcomingEvents: import('../data/timeline.js').TimelineEvent[],
 * }}
 */
export function findActiveEvent(events, now) {
  const timestamps = parsedTimestampsFor(events)
  let lo = 0
  let hi = events.length - 1
  let activeIndex = -1

  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (timestamps[mid] <= now) {
      activeIndex = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }

  return {
    activeEvent: activeIndex === -1 ? null : events[activeIndex],
    nextEvent: activeIndex + 1 < events.length ? events[activeIndex + 1] : null,
    pastEvents: events.slice(0, activeIndex === -1 ? 0 : activeIndex),
    upcomingEvents: events.slice(activeIndex + 1),
  }
}

/**
 * @param {number} now - epoch ms
 * @param {import('../data/timeline.js').TimelineEvent[]} events
 */
export function useTimelineState(now, events) {
  const { activeEvent, nextEvent, pastEvents, upcomingEvents } = findActiveEvent(events, now)

  return {
    activeEvent,
    nextEvent,
    // Before the first event, default to filter-on — the safe starting
    // state for solar viewing (spec §4.2: filterOn is "state AFTER this
    // event", so there is no event yet to read it from).
    filterOn: activeEvent ? activeEvent.filterOn : true,
    pastEvents,
    upcomingEvents,
  }
}
