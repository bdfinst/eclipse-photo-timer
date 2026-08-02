/**
 * Screen Wake Lock service — keeps the display on during the live eclipse
 * timeline so the operator never has to touch (and potentially misalign)
 * the device. Mirrors the { ok, reason } convention established in
 * services/audio.js rather than throwing — losing the wake lock is a
 * degraded-but-continuable state, not a crash.
 */

export async function requestWakeLock() {
  if (typeof navigator === 'undefined' || !navigator.wakeLock) {
    return { ok: false, reason: 'unsupported' }
  }

  try {
    const sentinel = await navigator.wakeLock.request('screen')
    return { ok: true, sentinel }
  } catch (error) {
    return { ok: false, reason: error.message }
  }
}
