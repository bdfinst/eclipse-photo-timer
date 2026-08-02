import { useEffect, useState } from 'react'
import { requestWakeLock } from '../services/wakelock.js'

/**
 * Requests the screen wake lock on mount and re-requests it whenever the
 * tab regains visibility — the browser releases a wake lock automatically
 * when a tab is backgrounded, so this is the only way to keep the screen on
 * across the whole live timeline (spec §7 / plan Slice 7). Reports failure
 * state so the consumer can warn the operator to set auto-lock to Never.
 *
 * @returns {{ failed: boolean, reason: string | null }}
 */
export function useWakeLock() {
  const [state, setState] = useState({ failed: false, reason: null })

  useEffect(() => {
    let cancelled = false
    let sentinel = null
    // Guards against two overlapping acquires (mount + a visibilitychange
    // firing before the first request resolves): without it, the older
    // request could resolve second and overwrite tracking of the newer
    // sentinel, leaking the newer one forever.
    let generation = 0

    async function acquire() {
      sentinel?.release?.()
      sentinel = null
      const thisGeneration = ++generation

      const result = await requestWakeLock()
      if (cancelled || thisGeneration !== generation) {
        result.sentinel?.release?.()
        return
      }
      sentinel = result.sentinel ?? null
      setState(
        result.ok ? { failed: false, reason: null } : { failed: true, reason: result.reason },
      )
    }

    acquire()

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        acquire()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      cancelled = true
      sentinel?.release?.()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  return state
}
