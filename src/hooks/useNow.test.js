import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useNow } from './useNow.js'

describe('useNow', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('ticks every 250ms, recomputing from clockService.now() fresh each time rather than accumulating', () => {
    const values = [1000, 2000, 3000]
    let callCount = 0
    const clockService = { now: vi.fn(() => values[callCount++]) }

    const { result } = renderHook(() => useNow(clockService))
    expect(result.current).toBe(1000)

    act(() => {
      vi.advanceTimersByTime(250)
    })
    expect(result.current).toBe(2000)

    act(() => {
      vi.advanceTimersByTime(250)
    })
    expect(result.current).toBe(3000)

    // Exactly one now() call per elapsed 250ms tick (plus the initial render) —
    // proves each tick reads a fresh value rather than deriving from a running total.
    expect(clockService.now).toHaveBeenCalledTimes(3)
  })

  it('does not tick before 250ms and does not double-tick within one interval', () => {
    const clockService = { now: vi.fn().mockReturnValue(1000) }
    renderHook(() => useNow(clockService))
    expect(clockService.now).toHaveBeenCalledTimes(1)

    act(() => {
      vi.advanceTimersByTime(249)
    })
    expect(clockService.now).toHaveBeenCalledTimes(1)

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(clockService.now).toHaveBeenCalledTimes(2)
  })

  it('recomputes immediately on regaining visibility rather than waiting for the next tick', () => {
    const clockService = { now: vi.fn() }
    clockService.now.mockReturnValueOnce(1000).mockReturnValueOnce(9999)

    const { result } = renderHook(() => useNow(clockService))
    expect(result.current).toBe(1000)

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(result.current).toBe(9999)
  })

  it('stops ticking and stops recomputing on visibilitychange after unmount', () => {
    const clockService = { now: vi.fn().mockReturnValue(1000) }
    const { unmount } = renderHook(() => useNow(clockService))
    const callsBeforeUnmount = clockService.now.mock.calls.length

    unmount()

    act(() => {
      vi.advanceTimersByTime(1000) // several 250ms ticks' worth
    })
    expect(clockService.now).toHaveBeenCalledTimes(callsBeforeUnmount)

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(clockService.now).toHaveBeenCalledTimes(callsBeforeUnmount)
  })
})
