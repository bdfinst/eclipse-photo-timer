import { useRef, useState } from 'react'
import { unlockAudio } from '../services/audio.js'

/**
 * Maps an `unlockAudio()` result to the tri-state audio-unlock status
 * (spec §7.1): `'unlocked'` on success, `'failed'` otherwise. Shared
 * between App.jsx's GO LIVE gesture and this hook's own direct-tap path
 * so both encode the mapping identically.
 */
export function audioStatusFromResult(result) {
  return result.ok ? 'unlocked' : 'failed'
}

/**
 * Owns the live screen's audio-unlock status and the tap-to-enable
 * gesture's focus-management: `initialStatus` is `'pending'` (no prior
 * unlock attempt — e.g. the app was opened directly on this screen),
 * `'unlocked'`, or `'failed'` (GO LIVE already attempted and failed).
 * `unlock()` performs the direct-tap gesture itself (spec §7.1's "Tap to
 * enable audio" overlay is the required user gesture in this case) and
 * moves focus to whatever element `contentRef` is attached to once
 * resolved.
 *
 * @param {'pending' | 'unlocked' | 'failed'} initialStatus
 * @returns {{
 *   status: 'pending' | 'unlocked' | 'failed',
 *   contentRef: import('react').RefObject<HTMLElement>,
 *   unlock: () => void,
 * }}
 */
export function useAudioUnlock(initialStatus = 'pending') {
  const [status, setStatus] = useState(initialStatus)
  const contentRef = useRef(null)

  function unlock() {
    const result = unlockAudio()
    setStatus(audioStatusFromResult(result))
    contentRef.current?.focus()
  }

  return { status, contentRef, unlock }
}
