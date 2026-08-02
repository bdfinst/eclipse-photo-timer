import { useEffect, useRef } from 'react'
import { EVENTS } from '../data/timeline.js'
import { speak, playTone } from '../services/audio.js'
import { clockService, getRehearsalSpeed } from '../services/clock.js'

// Above 2x rehearsal speed, speech is suppressed (tones only) — spec §8:
// "At speeds above 2×, suppress speech and keep tones only."
const MAX_SPEECH_SPEED = 2

// This hook implements spec §7.4's catch-up rule itself (see
// useAnnouncements' docstring), rather than calling audio.js's
// `shouldAnnounce` — that earlier, single-instant/single-leadSeconds helper
// predates this hook's per-event multi-instant schedule (lead, five-second,
// ten warning tones, due) and per-tick resume/offset-jump detection, which
// don't reduce cleanly to its one `announceAt >= now` check. `shouldAnnounce`
// is kept as-is (still tested in audio.test.js) since it's part of Slice 6's
// already-shipped, independently-reviewed public contract.

// Critical events default to a 10s lead-voice announcement; non-critical
// events default to none (spec §7.2). An explicit `event.leadSeconds`
// always overrides this default, for either kind of event.
const DEFAULT_CRITICAL_LEAD_SECONDS = 10
const FIVE_SECOND_OFFSET = 5
// Critical event T−10 through T−1 warning blip, once per whole second,
// independent of any custom leadSeconds override (spec §7.3).
const WARNING_TONE_OFFSETS = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
// c2/c3 get the distinct filter-toggle sweep instead of the standard due
// cue — both happen to be critical, but this overrides critical-due
// specifically for these two ids (spec §7.3).
const FILTER_TOGGLE_EVENT_IDS = new Set(['c2', 'c3'])

function resolveLeadSeconds(event) {
  if (typeof event.leadSeconds === 'number') {
    return event.leadSeconds
  }
  return event.critical ? DEFAULT_CRITICAL_LEAD_SECONDS : 0
}

function dueCue(event) {
  if (FILTER_TOGGLE_EVENT_IDS.has(event.id)) {
    return 'filter-toggle'
  }
  return event.critical ? 'critical-due' : 'non-critical-due'
}

/**
 * Every audio instant a single timeline event can trigger, expressed as an
 * offset in seconds before `event.at` so the hook can check each one
 * uniformly against `now`. Non-critical events with the default (zero)
 * lead get no separate lead-voice announcement — only their due tone
 * fires (spec §7.2's "Non-critical event announcement fires with zero
 * lead" scenario) — unless the timeline data explicitly sets a positive
 * `leadSeconds` override.
 *
 * @param {import('../data/timeline.js').TimelineEvent} event
 */
export function getScheduledInstants(event) {
  const leadSeconds = resolveLeadSeconds(event)
  const instants = []

  if (leadSeconds > 0) {
    instants.push({
      key: `${event.id}:lead`,
      offsetSeconds: leadSeconds,
      type: 'speak',
      text: event.speak ?? event.title,
    })
  }

  if (event.critical) {
    instants.push({
      key: `${event.id}:five`,
      offsetSeconds: FIVE_SECOND_OFFSET,
      type: 'speak',
      text: 'five seconds',
    })

    for (const offsetSeconds of WARNING_TONE_OFFSETS) {
      instants.push({
        key: `${event.id}:warn:${offsetSeconds}`,
        offsetSeconds,
        type: 'tone',
        cue: 'critical-warning',
      })
    }
  }

  instants.push({
    key: `${event.id}:due`,
    offsetSeconds: 0,
    type: 'tone',
    cue: dueCue(event),
  })

  return instants
}

function fire(instant, audioMasterOn, audioVoiceOn, audioTonesOn, rehearsalSpeed) {
  if (!audioMasterOn) {
    return
  }

  if (instant.type === 'speak') {
    if (audioVoiceOn && rehearsalSpeed <= MAX_SPEECH_SPEED) {
      speak(instant.text)
    }
    return
  }

  if (audioTonesOn) {
    playTone(instant.cue)
  }
}

/**
 * Fires speak()/playTone() exactly once per scheduled announcement instant
 * (see getScheduledInstants) as the tick loop's `now` reaches it, gated by
 * the persisted audio settings — master off suppresses both, voice off
 * suppresses speak() only, tones off suppresses playTone() only. An
 * instant is still marked consumed even when a setting suppressed its
 * output, so flipping the setting back on later never replays it.
 *
 * Catch-up rule (spec §7.4): an instant already due-or-past the very first
 * time this hook observes it (e.g. the app mounted mid-sequence) is marked
 * consumed WITHOUT firing — it never announces. Only instants still in the
 * future at first observation are armed to fire once a later tick reaches
 * them.
 *
 * Deliberate scope boundary: this covers mount, which is what plan Step
 * 9.4's own scenario tests ("opening the app mid-sequence", plans/
 * eclipse-timer.md:885, and docs/specs/eclipse-timer.md §13's
 * "no-announce-for-past-events" test category). It does NOT separately
 * re-detect a mid-session resume-from-backgrounding gap that crosses an
 * instant already armed as pending before the tab was hidden — a general
 * fix for that (flagging a large gap between consecutive `now` values as
 * its own catch-up trigger) was attempted and reverted: it broke
 * LiveScreen.test.jsx's "keeps announcing future ones" case (the
 * "LiveScreen announcement catch-up" describe block), which fast-forwards
 * `now` via `vi.setSystemTime` across a 25-minute span in one jump to
 * reach a still-legitimately-future instant. That test's single large
 * observed `now` delta is indistinguishable, from this hook's viewpoint,
 * from a genuine backgrounding gap — proving a gap-size heuristic is
 * unreliable in both directions (a fast-forwarded-but-never-backgrounded
 * session looks identical to a real gap). Getting this right needs
 * `useNow` itself to signal "this update followed a visibilitychange
 * resume" rather than this hook guessing from timestamp deltas alone — a
 * larger change to an already-shipped hook, out of scope for this slice.
 *
 * @param {number} now - epoch ms, from useNow
 * @param {boolean} audioMasterOn
 * @param {boolean} audioVoiceOn
 * @param {boolean} audioTonesOn
 */
export function useAnnouncements(now, audioMasterOn, audioVoiceOn, audioTonesOn) {
  const consumedRef = useRef(new Set())
  const isFirstTickRef = useRef(true)

  useEffect(() => {
    const isFirstTick = isFirstTickRef.current
    isFirstTickRef.current = false

    // Read fresh each tick — same pattern as the audio settings above — so a
    // speed change mid-rehearsal takes effect on the very next tick. Gated
    // on isRehearsal(): the persisted speed setting outlives the rehearsal
    // session itself (nothing clears it on exit), so treating a stale
    // leftover "60" as real speed on the actual live eclipse-day run would
    // silently suppress every announcement — the one thing this app exists
    // to get right when it matters most.
    const rehearsalSpeed = clockService.isRehearsal() ? getRehearsalSpeed() : 1

    for (const event of EVENTS) {
      const eventAtMs = Date.parse(event.at)

      for (const instant of getScheduledInstants(event)) {
        if (consumedRef.current.has(instant.key)) {
          continue
        }

        const atMs = eventAtMs - instant.offsetSeconds * 1000
        if (atMs > now) {
          continue // not due yet; re-checked on a later tick
        }

        consumedRef.current.add(instant.key)

        if (isFirstTick) {
          continue // catch-up rule: already past on first observation
        }

        fire(instant, audioMasterOn, audioVoiceOn, audioTonesOn, rehearsalSpeed)
      }
    }
  }, [now, audioMasterOn, audioVoiceOn, audioTonesOn])
}
