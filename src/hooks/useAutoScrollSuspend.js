import { useCallback, useEffect, useRef, useState } from 'react'

// "retargeted at most once per second" (spec §6.2 / plan Slice 8 Step 8.3).
const RETARGET_MIN_INTERVAL_MS = 1000
// "12 seconds of no touch" resumes auto-scroll after a manual scroll (spec §6.2).
const RESUME_AFTER_MS = 12000
// A scrollIntoView() call resolves its motion asynchronously (the browser
// has no completion callback for it), so a 'scroll' event arriving this
// soon after our own call is treated as an echo of it, not a manual scroll.
// Refreshed on each recognized echo (a smooth scroll keeps emitting events
// for its whole duration), but only within PROGRAMMATIC_SCROLL_MAX_MS of the
// original call — otherwise a real manual drag that happens to start within
// this window right after a scrollIntoView call would refresh forever and
// never register as manual.
const PROGRAMMATIC_SCROLL_WINDOW_MS = 500
const PROGRAMMATIC_SCROLL_MAX_MS = 1500

/**
 * Encapsulates the live event list's auto-scroll behaviour (plan Slice 8
 * Step 8.3): keeps the active card in view via `scrollIntoView`, retargeted
 * at most once per second; the very first scroll is instant (`behavior:
 * 'auto'`) rather than animated, so a GO LIVE tap mid-timeline doesn't
 * trigger a multi-second scroll the moment the operator first looks;
 * subsequent retargets are smooth. A manual scroll (one this hook did not
 * itself cause) suspends auto-scroll and surfaces `showResumePill`; tapping
 * `resume()` or 12s of no further manual scroll resumes it.
 *
 * `activeKey` is whatever identifies "the card that should be centred right
 * now" (e.g. the active event's id, falling back to the next event's id) —
 * retargeting is triggered by this value changing, not by re-deriving it
 * here, since only the caller (LiveScreen) knows the timeline state.
 *
 * @param {{ activeKey?: string | null, prefersReducedMotion?: boolean }} [options]
 * @returns {{
 *   containerRef: import('react').RefObject<HTMLElement>,
 *   setActiveCardRef: (node: HTMLElement | null) => void,
 *   showResumePill: boolean,
 *   resume: () => void,
 * }}
 */
export function useAutoScrollSuspend({ activeKey = null, prefersReducedMotion = false } = {}) {
  const containerRef = useRef(null)
  const activeCardRef = useRef(null)
  const [suspended, setSuspended] = useState(false)

  const hasScrolledRef = useRef(false)
  const lastScrollAtRef = useRef(0)
  const pendingRetargetRef = useRef(null)
  const resumeTimeoutRef = useRef(null)
  // Timestamps of our own last scrollIntoView() call, so the scroll listener
  // below can tell "we did this" apart from a real manual scroll. `last` is
  // refreshed by each recognized echo (extends the window); `started` is
  // fixed at the original call (bounds it).
  const lastProgrammaticScrollAtRef = useRef(-Infinity)
  const programmaticScrollStartedAtRef = useRef(-Infinity)

  const setActiveCardRef = useCallback((node) => {
    activeCardRef.current = node
  }, [])

  const performScroll = useCallback(() => {
    const node = activeCardRef.current
    if (!node || typeof node.scrollIntoView !== 'function') {
      return
    }

    const behavior = !hasScrolledRef.current || prefersReducedMotion ? 'auto' : 'smooth'
    const now = Date.now()
    lastProgrammaticScrollAtRef.current = now
    programmaticScrollStartedAtRef.current = now
    // block: 'center' per the plan's own Step 8.3 IMPLEMENT text and
    // eclipse-timer-spec.md §6.2's literal code sample — that same section
    // also describes the target position in prose as "about one third down
    // the viewport", which `block: 'center'` does not literally produce.
    // Kept as specified rather than reconciled unilaterally; center is a
    // reasonable reading of "roughly" and scrollIntoView has no built-in
    // one-third alignment.
    node.scrollIntoView({ behavior, block: 'center' })
    hasScrolledRef.current = true
    lastScrollAtRef.current = now
  }, [prefersReducedMotion])

  // Retarget whenever activeKey changes, throttled to at most once/second.
  useEffect(() => {
    if (suspended || activeKey == null) {
      return undefined
    }

    if (pendingRetargetRef.current) {
      clearTimeout(pendingRetargetRef.current)
      pendingRetargetRef.current = null
    }

    const elapsedSinceLastScroll = Date.now() - lastScrollAtRef.current
    if (!hasScrolledRef.current || elapsedSinceLastScroll >= RETARGET_MIN_INTERVAL_MS) {
      performScroll()
    } else {
      const wait = RETARGET_MIN_INTERVAL_MS - elapsedSinceLastScroll
      pendingRetargetRef.current = setTimeout(() => {
        pendingRetargetRef.current = null
        performScroll()
      }, wait)
    }

    return () => {
      if (pendingRetargetRef.current) {
        clearTimeout(pendingRetargetRef.current)
        pendingRetargetRef.current = null
      }
    }
  }, [activeKey, suspended, performScroll])

  const resume = useCallback(() => {
    if (resumeTimeoutRef.current) {
      clearTimeout(resumeTimeoutRef.current)
      resumeTimeoutRef.current = null
    }
    setSuspended(false)
  }, [])

  const suspend = useCallback(() => {
    setSuspended(true)
    if (resumeTimeoutRef.current) {
      clearTimeout(resumeTimeoutRef.current)
    }
    resumeTimeoutRef.current = setTimeout(() => {
      resumeTimeoutRef.current = null
      resume()
    }, RESUME_AFTER_MS)
  }, [resume])

  // Manual-scroll detection: a real user scroll on the container suspends
  // auto-scroll; a scroll this hook caused itself does not.
  useEffect(() => {
    const node = containerRef.current
    if (!node || typeof node.addEventListener !== 'function') {
      return undefined
    }

    function handleScroll() {
      const now = Date.now()
      const sinceLastEcho = now - lastProgrammaticScrollAtRef.current
      const sinceScrollStarted = now - programmaticScrollStartedAtRef.current
      const isEcho = sinceLastEcho < PROGRAMMATIC_SCROLL_WINDOW_MS

      if (isEcho && sinceScrollStarted < PROGRAMMATIC_SCROLL_MAX_MS) {
        // An echo of our own scrollIntoView call, not a manual scroll — a
        // smooth scroll keeps emitting these for its whole duration, so
        // refresh the trailing window on each one rather than only
        // measuring from the original call (otherwise an echo landing
        // >500ms after the call, routine for a multi-hundred-ms smooth
        // animation, would read as manual). Bounded by
        // PROGRAMMATIC_SCROLL_MAX_MS from the original call so a real
        // manual drag that happens to start inside this window can't
        // refresh it forever and go undetected.
        lastProgrammaticScrollAtRef.current = now
        return
      }
      suspend()
    }

    node.addEventListener('scroll', handleScroll)
    return () => node.removeEventListener('scroll', handleScroll)
  }, [suspend])

  useEffect(() => {
    return () => {
      if (pendingRetargetRef.current) {
        clearTimeout(pendingRetargetRef.current)
      }
      if (resumeTimeoutRef.current) {
        clearTimeout(resumeTimeoutRef.current)
      }
    }
  }, [])

  return {
    containerRef,
    setActiveCardRef,
    showResumePill: suspended,
    resume,
  }
}
