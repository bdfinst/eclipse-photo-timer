import { C2 } from '../data/timeline.js'
import { formatUtcTime } from '../lib/formatTime.js'
import { formatDuration } from '../lib/formatDuration.js'

const C2_MS = Date.parse(C2)

/**
 * `T− 00:04:10` / `T+ 00:00:38` relative to C2 (spec §6.3), using U+2212
 * (minus sign, matching Countdown.jsx's existing "T− " convention) for
 * events before C2.
 */
function formatRelativeLabel(atMs) {
  const diffMs = atMs - C2_MS
  const sign = diffMs < 0 ? '−' : '+'
  const totalSeconds = Math.round(Math.abs(diffMs) / 1000)

  return `T${sign} ${formatDuration(totalSeconds)}`
}

// Phase left-edge colours (spec §6.4): prep grey, partials blue, handovers
// amber, totality red, done green.
const PHASE_BORDER_COLOR = {
  prep: 'border-l-slate-400',
  'partial-1': 'border-l-blue-500',
  'partial-2': 'border-l-blue-500',
  'handover-in': 'border-l-amber-500',
  'handover-out': 'border-l-amber-500',
  totality: 'border-l-red-600',
  done: 'border-l-green-600',
}

// State treatments from the Scenario Outline (spec §6.3). Padding is split
// out from the rest of `container` so `compact` (the totality block's
// tighter-spacing mode, spec §6.3 penultimate paragraph) can override just
// the vertical spacing without fighting the state's own padding utility.
const STATE_STYLES = {
  past: {
    container: 'opacity-40',
    padding: 'py-1',
    title: 'text-sm font-medium',
    showDetail: false,
  },
  active: {
    container: 'opacity-100 ring-2 ring-sky-400',
    padding: 'py-4',
    title: 'text-xl font-bold',
    showDetail: true,
  },
  'next-up': {
    container: 'opacity-100 shadow-md -translate-y-0.5',
    padding: 'py-3',
    title: 'text-base font-semibold',
    showDetail: true,
  },
  future: {
    container: 'opacity-100',
    padding: 'py-3',
    title: 'text-base font-semibold',
    showDetail: true,
  },
  'future-far': {
    container: 'opacity-100',
    padding: 'py-1',
    title: 'text-sm font-medium',
    showDetail: false,
  },
}

// Tighter vertical spacing for the totality compact block (spec §6.3): all
// nine totality events plus c3 must fit on one screen with no scroll.
const COMPACT_PADDING = 'py-0.5'

/**
 * Renders one timeline event with its state-driven styling (spec §6.3) and
 * phase left-edge colour (spec §6.4). `state` is precomputed by the caller
 * (LiveScreen has activeEvent/nextEvent/pastEvents/upcomingEvents already,
 * from useTimelineState) rather than derived here from `now` — the cleanest
 * split since EventCard has no other need for the current time.
 *
 * `ref` (React 19 accepts `ref` as a plain prop on function components — no
 * `forwardRef` needed) is forwarded to the root element so LiveScreen can
 * wire the currently-active card into `useAutoScrollSuspend`'s
 * `setActiveCardRef`.
 *
 * @param {{
 *   event: import('../data/timeline.js').TimelineEvent,
 *   state: 'past' | 'active' | 'next-up' | 'future' | 'future-far',
 *   prefersReducedMotion?: boolean,
 *   compact?: boolean,
 *   ref?: import('react').Ref<HTMLDivElement>,
 * }} props
 */
function EventCard({ event, state, prefersReducedMotion = false, compact = false, ref }) {
  const styles = STATE_STYLES[state]
  const atMs = Date.parse(event.at)

  // Critical events get a heavier border and a warmer accent regardless of
  // STATE (spec §6.3) — but §6.4's phase colour must still read peripherally
  // ("position in the day"), so criticality thickens the border and adds a
  // warm glow rather than replacing the phase colour outright.
  const borderClass = event.critical
    ? `border-l-8 ${PHASE_BORDER_COLOR[event.phase]}`
    : `border-l-4 ${PHASE_BORDER_COLOR[event.phase]}`
  const criticalAccentClass = event.critical ? 'bg-amber-950/20' : ''

  const pulseClass = state === 'active' && !prefersReducedMotion ? 'animate-pulse' : ''
  const paddingClass = compact ? COMPACT_PADDING : styles.padding

  const className = [
    'px-3',
    borderClass,
    criticalAccentClass,
    styles.container,
    paddingClass,
    pulseClass,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      ref={ref}
      data-testid="event-card"
      data-state={state}
      data-event-id={event.id}
      className={className}
    >
      <div className="flex items-baseline gap-2 text-xs text-slate-300">
        <span>{formatUtcTime(atMs)}</span>
        <span>{formatRelativeLabel(atMs)}</span>
        {event.mode && (
          // "DIAL" prefix: the custom-mode positions share C1–C4 names with
          // the eclipse contacts — an unprefixed chip reading "C2" next to
          // an event near second contact is genuinely ambiguous.
          <span className="rounded bg-slate-700 px-1 font-semibold text-white">
            DIAL {event.mode}
          </span>
        )}
      </div>
      <p className={styles.title}>{event.title}</p>
      {styles.showDetail && event.detail && (
        <p className="text-sm text-slate-300">{event.detail}</p>
      )}
    </div>
  )
}

export default EventCard
