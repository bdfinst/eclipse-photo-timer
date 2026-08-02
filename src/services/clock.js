/**
 * ClockService is the sole source of "now" for the whole app — nothing else
 * may call Date.now() directly (spec §3.1, §8).
 *
 * Exported as a plain module-level singleton object, not a factory: JS
 * modules are cached on first import, so every importer shares this exact
 * instance and observes the same rehearsal state automatically.
 *
 * The virtual clock's position and rate (_virtual/_speed/_startedAt) live
 * only in this module's in-memory closure — never written to storage.js,
 * so they can never outlive a page load. The operator's *selected*
 * rehearsal speed (REHEARSAL_SPEED_KEY below) is a UI preference, not part
 * of that in-memory state, and DOES persist across reloads — callers must
 * read it only while `isRehearsal()` is true (see useAnnouncements.js),
 * since nothing clears it on exiting rehearsal.
 */

import { getItem, setItem } from './storage.js'

// Rehearsal speed selection persists across rerenders/mounts the same way
// the audio settings do (audio.js's AUDIO_MASTER_KEY etc.) — canonical home
// here since this is the clock's own rehearsal concept, read fresh by
// RehearsalPanel.jsx (UI) and useAnnouncements.js (speech-gating) alike.
// Deliberately NOT a clockService method (spec §8's ClockService interface
// is exactly now/isRehearsal/setVirtual/clearVirtual, no speed getter).
export const REHEARSAL_SPEED_KEY = 'eclipse.rehearsalSpeed'

/** Reads the persisted rehearsal speed, defaulting to 1x on anything malformed. */
export function getRehearsalSpeed() {
  const raw = getItem(REHEARSAL_SPEED_KEY, 1)
  return Number.isFinite(raw) ? raw : 1
}

export function setRehearsalSpeed(speed) {
  setItem(REHEARSAL_SPEED_KEY, speed)
}

let _virtual = null
let _speed = 1
let _startedAt = 0

function realNow() {
  const raw = getItem('eclipse.clockOffsetMs', 0)
  // Malformed-but-valid JSON (a string, object, NaN, +/-Infinity) must
  // never poison the app's sole "now" source — fall back to 0 rather than
  // trusting storage.js's type-agnostic default contract.
  const clockOffsetMs = Number.isFinite(raw) ? raw : 0
  return Date.now() + clockOffsetMs
}

export const clockService = {
  now() {
    if (_virtual !== null) {
      return _virtual + (Date.now() - _startedAt) * _speed
    }

    return realNow()
  },

  isRehearsal() {
    return _virtual !== null
  },

  setVirtual(t, speed = 1) {
    _virtual = t
    _speed = speed
    _startedAt = Date.now()
  },

  clearVirtual() {
    _virtual = null
    _speed = 1
    _startedAt = 0
  },
}
