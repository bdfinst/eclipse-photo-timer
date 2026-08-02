import { useState } from 'react'
import { clockService, getRehearsalSpeed, setRehearsalSpeed } from '../services/clock.js'
import { resetAnnouncementState } from './useAnnouncements.js'

// Module-level, not component-local: RehearsalPanel (and this hook with it)
// can now unmount and remount within the same session — the operator can
// GO LIVE and tap "← Setup" to come back (see App.jsx) — while the
// underlying clockService clock keeps running (or stays paused) the whole
// time. `clockService` deliberately exposes no speed/paused getter (spec
// §8's ClockService interface), so "is it currently paused, and at what
// speed should Resume restore" can only live here — but a plain useState
// would silently reset to "not paused" / "1x" on remount, desyncing the
// Transport UI from the clock's real state and, worse, making Resume
// restore the wrong speed after a pause-then-round-trip. Session-scoped
// module state (same fix already applied to useAnnouncements' consumed-
// instant tracking, for the same remount reason) keeps both accurate.
let sessionPaused = false
let sessionPreSpeed = 1

// Test-isolation-only export (mirrors useAnnouncements' resetAnnouncementState):
// nothing in production ever needs to reset this mid-session, since a real
// pause/resume/toggle-off/reset always keeps it in sync via the setters
// above. Without this, one test leaving the session paused would leak that
// into the next render in the same test file.
export function resetRehearsalControlsState() {
  sessionPaused = false
  sessionPreSpeed = 1
}

/**
 * Owns rehearsal mode's transport state machine (spec §8): on/off, speed,
 * paused, and the handlers that keep them in sync with `clockService` (an
 * external singleton, not React state) — mirroring the `useWakeLock`/
 * `useAudioUnlock` pattern of extracting state+handlers out of the
 * component that renders them.
 *
 * @returns {{
 *   rehearsalOn: boolean,
 *   speed: number,
 *   paused: boolean,
 *   toggle: () => void,
 *   jumpTo: (targetMs: number) => void,
 *   selectSpeed: (speed: number) => void,
 *   pause: () => void,
 *   resume: () => void,
 *   reset: () => void,
 * }}
 */
export function useRehearsalControls() {
  const [rehearsalOn, setRehearsalOn] = useState(() => clockService.isRehearsal())
  const [speed, setSpeed] = useState(() => getRehearsalSpeed())
  // The speed in effect immediately before Pause, so Resume can restore it.
  // Initialized from the module-level session value (see above) rather than
  // always 1, so a remount while paused still resumes at the right speed.
  const [preSpeed, setPreSpeedState] = useState(() => sessionPreSpeed)
  const [paused, setPausedState] = useState(() => sessionPaused)

  function setPaused(value) {
    sessionPaused = value
    setPausedState(value)
  }

  function setPreSpeed(value) {
    sessionPreSpeed = value
    setPreSpeedState(value)
  }

  function toggle() {
    if (rehearsalOn) {
      // clearVirtual() jumps `now` back to real time — the same kind of
      // clock discontinuity as jumpTo (see its comment below), just in the
      // other direction: without this, exiting rehearsal after practicing a
      // sequence and then genuinely reaching that same window live would
      // find it already marked consumed, and silently announce nothing.
      resetAnnouncementState()
      clockService.clearVirtual()
      setRehearsalOn(false)
      setPaused(false)
      return
    }

    // Arm at the currently-selected speed, not a hardcoded 1x — otherwise
    // the persisted speed (and the Speed panel's own selected button) would
    // desync from the rate the clock is actually running at.
    clockService.setVirtual(clockService.now(), speed)
    setRehearsalOn(true)
  }

  function jumpTo(targetMs) {
    const currentSpeed = getRehearsalSpeed()

    // A jump can move the clock BACKWARD, deliberately re-entering a window
    // already rehearsed once (that's the whole point — practice the same
    // approach repeatedly). useAnnouncements' consumed/first-tick state is
    // session-scoped (persists across LiveScreen mount/unmount, spec §8's
    // own reason for existing — "this app is unusable if it cannot be
    // tested"), so without this reset a second run through the same window
    // would silently announce nothing at all: every instant in it is
    // already marked consumed from the first run.
    resetAnnouncementState()
    clockService.setVirtual(targetMs, currentSpeed)
    setRehearsalOn(true)
    // A jump always leaves the clock running at the current speed (that's
    // what setVirtual above just did) — the operator jumped to watch the
    // sequence play out, so the Transport control must reflect that it's no
    // longer paused, not keep showing a stale "Resume".
    setPaused(false)
  }

  function selectSpeed(newSpeed) {
    setRehearsalSpeed(newSpeed)
    setSpeed(newSpeed)

    if (paused) {
      // Still paused — record the new rate for when Resume is tapped, but
      // don't silently start the clock moving again just because a rate
      // was picked.
      setPreSpeed(newSpeed)
      return
    }

    // Re-arms from the current virtual instant so changing the rate never
    // resets the clock's position, only how fast it moves from here.
    clockService.setVirtual(clockService.now(), newSpeed)
    setRehearsalOn(true)
  }

  function pause() {
    setPreSpeed(speed)
    clockService.setVirtual(clockService.now(), 0)
    setPaused(true)
    // Matches jumpTo/selectSpeed's pattern of arming rehearsal on any
    // transport action — without this, tapping Pause before ever toggling
    // rehearsal on would freeze the app's sole "now" source while the
    // checkbox and RehearsalBanner still both read "not in rehearsal".
    setRehearsalOn(true)
  }

  function resume() {
    clockService.setVirtual(clockService.now(), preSpeed)
    setPaused(false)
  }

  function reset() {
    // Same clock-discontinuity reasoning as toggle()'s off-branch above.
    resetAnnouncementState()
    clockService.clearVirtual()
    setRehearsalOn(false)
    setPaused(false)
  }

  return { rehearsalOn, speed, paused, toggle, jumpTo, selectSpeed, pause, resume, reset }
}
