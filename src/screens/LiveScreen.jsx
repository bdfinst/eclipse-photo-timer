import { useNow } from '../hooks/useNow.js'
import { useTimelineState } from '../hooks/useTimelineState.js'
import { useWakeLock } from '../hooks/useWakeLock.js'
import { clockService } from '../services/clock.js'
import { getItem } from '../services/storage.js'
import { EVENTS } from '../data/timeline.js'
import FilterBanner from '../components/FilterBanner.jsx'
import NextAction from '../components/NextAction.jsx'

/**
 * Formats epoch ms as UTC `HH:MM:SS` (spec §3.1 — Iceland is UTC year-round,
 * never convert timezone).
 */
function formatUtcTime(nowMs) {
  return new Date(nowMs).toISOString().slice(11, 19)
}

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
  const { filterOn, nextEvent } = useTimelineState(now, EVENTS)
  // The stored offset only applies to the real clock — clockService.now()
  // ignores it entirely while a rehearsal virtual clock is set (clock.js),
  // so annotating with it during rehearsal would misreport an offset that
  // was never actually applied to what's on screen.
  const rawOffsetMs = clockService.isRehearsal() ? 0 : getItem('eclipse.clockOffsetMs', 0)
  const offsetMs = Number.isFinite(rawOffsetMs) ? rawOffsetMs : 0
  const offsetAnnotation = formatOffsetAnnotation(offsetMs)
  const wakeLock = useWakeLock()

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
    </div>
  )
}

export default LiveScreen
