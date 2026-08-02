import { useMemo } from 'react'
import { useNow } from '../hooks/useNow.js'
import { useTimelineState } from '../hooks/useTimelineState.js'
import { useWakeLock } from '../hooks/useWakeLock.js'
import { useAutoScrollSuspend } from '../hooks/useAutoScrollSuspend.js'
import { clockService } from '../services/clock.js'
import { getItem } from '../services/storage.js'
import { EVENTS } from '../data/timeline.js'
import { formatUtcTime } from '../lib/formatTime.js'
import FilterBanner from '../components/FilterBanner.jsx'
import NextAction from '../components/NextAction.jsx'
import EventCard from '../components/EventCard.jsx'
import {
  deriveEventState,
  isTotalityBlockVisible,
  TOTALITY_BLOCK_EVENTS,
  TOTALITY_BLOCK_ID_SET,
} from './liveEventPresentation.js'

/**
 * Formats a non-zero clock offset as an annotation like "(+3s)"; returns
 * null for a zero (or sub-second, which would misleadingly round to "0s")
 * offset, so the caller can omit it entirely.
 */
function formatOffsetAnnotation(offsetMs) {
  const seconds = Math.round(Math.abs(offsetMs) / 1000)

  if (seconds === 0) {
    return null
  }

  const sign = offsetMs > 0 ? '+' : '−'

  return `(${sign}${seconds}s)`
}

function LiveScreen() {
  const now = useNow(clockService)
  const { filterOn, nextEvent, activeEvent, pastEvents } = useTimelineState(now, EVENTS)
  // The stored offset only applies to the real clock — clockService.now()
  // ignores it entirely while a rehearsal virtual clock is set (clock.js),
  // so annotating with it during rehearsal would misreport an offset that
  // was never actually applied to what's on screen.
  const rawOffsetMs = clockService.isRehearsal() ? 0 : getItem('eclipse.clockOffsetMs', 0)
  const offsetMs = Number.isFinite(rawOffsetMs) ? rawOffsetMs : 0
  const offsetAnnotation = formatOffsetAnnotation(offsetMs)
  const wakeLock = useWakeLock()

  const pastEventIds = useMemo(() => new Set(pastEvents.map((event) => event.id)), [pastEvents])
  const stateContext = { activeEvent, nextEvent, pastEventIds, now }

  // Visible once the timeline reaches this block — as soon as C2 is the
  // next event up to (and including) c3 still being active — so the
  // operator sees the whole totality sequence before it starts and until
  // it's fully handed back off (spec §6.3).
  const showTotalityBlock = isTotalityBlockVisible({ activeEvent, nextEvent })

  // While the totality block is showing, its 10 events are rendered there
  // instead of here, so they don't appear twice.
  const listEvents = useMemo(
    () =>
      showTotalityBlock ? EVENTS.filter((event) => !TOTALITY_BLOCK_ID_SET.has(event.id)) : EVENTS,
    [showTotalityBlock],
  )

  // The card auto-scroll keeps centred: the active event, or (before the
  // timeline starts, or after it ends) whichever card is standing in for
  // it — falling back to the next event, then to nothing. Whichever list
  // (totality block or the regular scroll list) actually renders this id
  // is the one that must wire the ref — see renderCard below.
  const activeCardKey = activeEvent?.id ?? nextEvent?.id ?? null
  const prefersReducedMotion = useMemo(
    () =>
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )
  const { containerRef, setActiveCardRef, showResumePill, resume } = useAutoScrollSuspend({
    activeKey: activeCardKey,
    prefersReducedMotion,
  })

  function renderCard(event, { compact = false } = {}) {
    return (
      <EventCard
        key={event.id}
        event={event}
        state={deriveEventState(event, stateContext)}
        prefersReducedMotion={prefersReducedMotion}
        compact={compact}
        ref={event.id === activeCardKey ? setActiveCardRef : undefined}
      />
    )
  }

  return (
    <div>
      <FilterBanner filterOn={filterOn} />
      <p>
        {formatUtcTime(now)}
        {offsetAnnotation && <span> {offsetAnnotation}</span>}
      </p>
      <NextAction event={nextEvent} now={now} />
      {wakeLock.failed && (
        <p role="alert" className="bg-amber-500 px-3 py-2 text-sm font-semibold text-black">
          Screen wake lock unavailable — set auto-lock to Never so the display does not sleep.
        </p>
      )}
      {showTotalityBlock && (
        <div data-testid="totality-block" className="flex flex-col gap-0.5">
          {TOTALITY_BLOCK_EVENTS.map((event) => renderCard(event, { compact: true }))}
        </div>
      )}
      <div
        ref={containerRef}
        data-testid="event-list"
        className="flex flex-col gap-1 overflow-y-auto"
      >
        {listEvents.map((event) => renderCard(event))}
      </div>
      {showResumePill && (
        <button
          type="button"
          onClick={resume}
          className="fixed bottom-4 right-4 rounded-full bg-slate-700 px-4 py-2 text-sm font-semibold text-white shadow-lg"
        >
          ↓ NOW
        </button>
      )}
    </div>
  )
}

export default LiveScreen
