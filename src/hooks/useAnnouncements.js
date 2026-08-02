import { useEffect } from 'react'
import { EVENTS } from '../data/timeline.js'
import { speak, playTone } from '../services/audio.js'
import { clockService, getRehearsalSpeed } from '../services/clock.js'

// Module-level, not component-local state (deliberately NOT a useRef):
// LiveScreen can now be unmounted and remounted within the same session
// (the operator can navigate back to the prep screen and return via GO
// LIVE again — see App.jsx). The catch-up rule below must apply once per
// SESSION, not once per LiveScreen MOUNT — a useRef would reset on every
// remount and silently swallow (as "catch-up") any announcement that
// genuinely became due while the operator was on the prep screen, exactly
// when it matters most. `resetAnnouncementState` is called for real by
// useRehearsalControls.js whenever the clock jumps discontinuously
// (jump-to, exiting rehearsal) — treating that as a fresh session start,
// the same way an actual page reload would be — as well as for test
// isolation between otherwise-independent test cases in the same file.
let consumedKeys = new Set()
let hasTicked = false

export function resetAnnouncementState() {
  consumedKeys = new Set()
  hasTicked = false
}

// Above 2x rehearsal speed, speech is suppressed (tones only) — spec §8:
// "At speeds above 2×, suppress speech and keep tones only."
const MAX_SPEECH_SPEED = 2

// An instant more than this stale on a non-first tick is treated like a
// catch-up instant (consumed, never fired), not a burst-fire opportunity.
// Without this bound, the module-level session state above (which lets a
// quick "← Setup" round trip still fire what became due while away) would
// also fire EVERY instant that became due during an arbitrarily long
// detour — e.g. returning after several minutes would burst-fire a whole
// backlog of stale reminders (including a "five seconds" callout for an
// event that happened minutes ago), which is exactly what spec §7.4's
// catch-up rule exists to prevent. 30s comfortably covers a quick check of
// the prep screen and back; anything stale beyond it is treated as missed.
// This is a REAL-time budget — scaled by rehearsal speed at the call site,
// since `now`/`atMs` are in the clock's own (possibly sped-up) domain.
const MAX_STALE_MS = 30_000

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
 * time this hook observes it (e.g. the app was opened mid-sequence) is
 * marked consumed WITHOUT firing — it never announces. Only instants still
 * in the future at first observation are armed to fire once a later tick
 * reaches them. This "first observation" is tracked per SESSION (a
 * module-level flag, not component state) rather than per LiveScreen
 * mount — the operator can navigate back to the prep screen and return via
 * GO LIVE without losing already-armed instants or re-triggering catch-up
 * for ones that became due in the meantime. That backlog is itself bounded
 * by MAX_STALE_MS: an instant more than 30 REAL seconds past due (scaled by
 * rehearsal speed when rehearsing — see below) on a non-first tick is still
 * treated as catch-up (consumed, not fired) rather than burst-fired, so a
 * long detour away from the live screen doesn't dump a pile of stale
 * reminders the moment the operator returns.
 *
 * This covers session start, which is what plan Step 9.4's own scenario
 * tests ("opening the app mid-sequence", plans/eclipse-timer.md:885, and
 * docs/specs/eclipse-timer.md §13's "no-announce-for-past-events" test
 * category).
 *
 * A mid-session resume-from-backgrounding gap (the tab was hidden while an
 * armed instant became due, then regained visibility) is now ALSO covered,
 * as a side effect of MAX_STALE_MS above rather than by detecting the gap
 * directly: a general fix that flagged a large gap between consecutive
 * `now` values as its own catch-up trigger was tried first and reverted —
 * it broke LiveScreen.test.jsx's "keeps announcing future ones" case (the
 * "LiveScreen announcement catch-up" describe block), which fast-forwards
 * `now` via `vi.setSystemTime` across a 25-minute span in one jump to reach
 * a still-legitimately-future instant with near-zero staleness at the
 * moment it fires. That test's single large TICK-TO-TICK delta looked
 * identical, from a gap-size heuristic's viewpoint, to a genuine
 * backgrounding gap. MAX_STALE_MS sidesteps that: it measures how stale a
 * given INSTANT is when observed, not how big the jump to reach it was, so
 * a big jump landing on a still-fresh instant (the fast-forward test) and a
 * big jump landing on a long-overdue one (a real backgrounding gap) are
 * correctly told apart.
 *
 * @param {number} now - epoch ms, from useNow
 * @param {boolean} audioMasterOn
 * @param {boolean} audioVoiceOn
 * @param {boolean} audioTonesOn
 */
export function useAnnouncements(now, audioMasterOn, audioVoiceOn, audioTonesOn) {
  useEffect(() => {
    const isFirstTick = !hasTicked
    hasTicked = true

    // Read fresh each tick — same pattern as the audio settings above — so a
    // speed change mid-rehearsal takes effect on the very next tick. Gated
    // on isRehearsal(): the persisted speed setting outlives the rehearsal
    // session itself (nothing clears it on exit), so treating a stale
    // leftover "60" as real speed on the actual live eclipse-day run would
    // silently suppress every announcement — the one thing this app exists
    // to get right when it matters most.
    const rehearsalSpeed = clockService.isRehearsal() ? getRehearsalSpeed() : 1
    // MAX_STALE_MS is a REAL-time budget ("a quick check and back"), but
    // `now`/`atMs` are in the clock's own domain — during rehearsal that's
    // virtual time advancing at `rehearsalSpeed`×. Scaling the bound keeps
    // it representing the same real-world detour length regardless of
    // playback rate; left flat it would silently drop far more at 10×/60×
    // than the same real seconds away would live, degrading exactly the
    // rehearsal fidelity spec §8 calls for ("fires exactly as it would live").
    const staleThresholdMs = MAX_STALE_MS * rehearsalSpeed

    for (const event of EVENTS) {
      const eventAtMs = Date.parse(event.at)

      for (const instant of getScheduledInstants(event)) {
        if (consumedKeys.has(instant.key)) {
          continue
        }

        const atMs = eventAtMs - instant.offsetSeconds * 1000
        if (atMs > now) {
          continue // not due yet; re-checked on a later tick
        }

        consumedKeys.add(instant.key)

        if (isFirstTick) {
          continue // catch-up rule: already past on first observation
        }

        if (now - atMs > staleThresholdMs) {
          continue // too stale to be a "just missed it" case — treat as catch-up
        }

        fire(instant, audioMasterOn, audioVoiceOn, audioTonesOn, rehearsalSpeed)
      }
    }
  }, [now, audioMasterOn, audioVoiceOn, audioTonesOn])
}
