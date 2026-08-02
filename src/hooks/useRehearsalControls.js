import { useState } from 'react'
import { clockService, getRehearsalSpeed, setRehearsalSpeed } from '../services/clock.js'

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
  // The speed in effect immediately before Pause, so Resume can restore it
  // (clockService itself exposes no speed getter — spec §8's ClockService
  // interface deliberately has none — so this has to be component state).
  const [preSpeed, setPreSpeed] = useState(1)
  const [paused, setPaused] = useState(false)

  function toggle() {
    if (rehearsalOn) {
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
    clockService.clearVirtual()
    setRehearsalOn(false)
    setPaused(false)
  }

  return { rehearsalOn, speed, paused, toggle, jumpTo, selectSpeed, pause, resume, reset }
}
