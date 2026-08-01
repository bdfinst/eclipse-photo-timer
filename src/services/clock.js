/**
 * ClockService is the sole source of "now" for the whole app — nothing else
 * may call Date.now() directly (spec §3.1, §8).
 *
 * Exported as a plain module-level singleton object, not a factory: JS
 * modules are cached on first import, so every importer shares this exact
 * instance and observes the same rehearsal state automatically.
 *
 * Rehearsal/virtual-clock state lives only in this module's in-memory
 * closure — it is never written to storage.js, so it can never outlive a
 * page load.
 */

import { getItem } from './storage.js'

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
