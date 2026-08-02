import { useEffect, useState } from 'react'

// 4 Hz — spec §3.1's tick rate for deriving "now" throughout the app.
const TICK_MS = 250

/**
 * Ticks at 4 Hz, always recomputing "now" from clockService.now() rather
 * than incrementing a running total — so a backgrounded tab, a clock-offset
 * change, or rehearsal speed change is reflected the instant the next tick
 * (or a visibilitychange recompute) fires.
 *
 * @param {{ now(): number }} clockService
 * @returns {number}
 */
export function useNow(clockService) {
  const [now, setNow] = useState(() => clockService.now())

  useEffect(() => {
    const recompute = () => setNow(clockService.now())
    const intervalId = setInterval(recompute, TICK_MS)

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        recompute()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [clockService])

  return now
}
