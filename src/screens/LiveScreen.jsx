import { useMemo } from 'react'
import { useNow } from '../hooks/useNow.js'
import { useTimelineState } from '../hooks/useTimelineState.js'
import { useWakeLock } from '../hooks/useWakeLock.js'
import { useAutoScrollSuspend } from '../hooks/useAutoScrollSuspend.js'
import { useAnnouncements } from '../hooks/useAnnouncements.js'
import { useAudioUnlock } from '../hooks/useAudioUnlock.js'
import { clockService } from '../services/clock.js'
import { getItem } from '../services/storage.js'
import { AUDIO_MASTER_KEY, AUDIO_VOICE_KEY, AUDIO_TONES_KEY } from '../services/audio.js'
import { EVENTS } from '../data/timeline.js'
import { formatUtcTime } from '../lib/formatTime.js'
import FilterBanner from '../components/FilterBanner.jsx'
import NextAction from '../components/NextAction.jsx'
import EventCard from '../components/EventCard.jsx'
import { RehearsalBanner } from '../components/RehearsalPanel.jsx'
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

// `initialAudioStatus` defaults to 'pending' — no prior unlock gesture has
// happened (e.g. the app was opened directly on this screen) — so the
// tap-to-enable overlay shows. GO LIVE (App.jsx) passes 'unlocked' or
// 'failed' instead, since that gesture already satisfied the browser's
// user-gesture requirement, successfully or not.
function LiveScreen({ initialAudioStatus = 'pending', onBack }) {
  const {
    status: audioStatus,
    contentRef: liveContentRef,
    unlock: handleUnlockTap,
  } = useAudioUnlock(initialAudioStatus)
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

  // Read fresh each render (every 250ms tick, since `now` changes) so a
  // setting toggled mid-session takes effect on the very next tick.
  const audioMasterOn = getItem(AUDIO_MASTER_KEY, true)
  const audioVoiceOn = getItem(AUDIO_VOICE_KEY, true)
  const audioTonesOn = getItem(AUDIO_TONES_KEY, true)
  useAnnouncements(now, audioMasterOn, audioVoiceOn, audioTonesOn)

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
    // pt: with viewport-fit=cover the page extends under the iOS status
    // bar — start the live content below it (resolves to 0 with no inset).
    <div className="pt-[env(safe-area-inset-top)]">
      <RehearsalBanner />
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="fixed right-2 top-[max(env(safe-area-inset-top),0.5rem)] z-10 rounded bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-white"
        >
          ← Setup
        </button>
      )}
      <div ref={liveContentRef} data-testid="live-content" tabIndex={-1}>
        <FilterBanner filterOn={filterOn} />
        <p>
          {formatUtcTime(now)}
          {offsetAnnotation && <span> {offsetAnnotation}</span>}
        </p>
        <NextAction event={nextEvent} now={now} />
      </div>
      {wakeLock.failed && (
        <p role="alert" className="bg-amber-500 px-3 py-2 text-sm font-semibold text-black">
          Screen wake lock unavailable — set auto-lock to Never so the display does not sleep.
        </p>
      )}
      {audioStatus === 'failed' && (
        <p role="alert" className="bg-amber-500 px-3 py-2 text-sm font-semibold text-black">
          Audio confirmation could not be verified — announcements may not be audible.
        </p>
      )}
      {/* The tap itself is the required user gesture for a direct-load-on-
          live-screen case (spec §7.1); useAudioUnlock moves focus to
          liveContentRef once resolved. jsdom performs no real visual
          layering, so this overlay is an additional element rather than a
          replacement of the content beneath it (see LiveScreen.test.jsx for
          the coexistence this preserves). */}
      {audioStatus === 'pending' && (
        <div
          role="dialog"
          aria-label="Enable audio"
          className="fixed inset-0 flex items-center justify-center bg-black/80"
        >
          <button
            type="button"
            onClick={handleUnlockTap}
            className="rounded bg-white px-6 py-3 text-lg font-semibold text-black"
          >
            Tap to enable audio
          </button>
        </div>
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
