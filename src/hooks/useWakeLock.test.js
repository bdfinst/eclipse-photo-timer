import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useWakeLock } from './useWakeLock.js'

describe('useWakeLock', () => {
  afterEach(() => {
    delete navigator.wakeLock
    vi.restoreAllMocks()
  })

  it('requests the wake lock on mount and reports no failure on success', async () => {
    const sentinel = { release: vi.fn() }
    const request = vi.fn().mockResolvedValue(sentinel)
    navigator.wakeLock = { request }

    const { result } = renderHook(() => useWakeLock())

    await act(async () => {})

    expect(request).toHaveBeenCalledWith('screen')
    expect(request).toHaveBeenCalledTimes(1)
    expect(result.current).toEqual({ failed: false, reason: null })
  })

  it('re-requests the wake lock when the tab regains visibility', async () => {
    const sentinel = { release: vi.fn() }
    const request = vi.fn().mockResolvedValue(sentinel)
    navigator.wakeLock = { request }

    renderHook(() => useWakeLock())
    await act(async () => {})
    expect(request).toHaveBeenCalledTimes(1)

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(request).toHaveBeenCalledTimes(2)
  })

  it('reports failure when navigator.wakeLock is unsupported', async () => {
    delete navigator.wakeLock

    const { result } = renderHook(() => useWakeLock())

    await act(async () => {})

    expect(result.current).toEqual({ failed: true, reason: 'unsupported' })
  })

  it('releases the held sentinel on unmount', async () => {
    const sentinel = { release: vi.fn() }
    const request = vi.fn().mockResolvedValue(sentinel)
    navigator.wakeLock = { request }

    const { unmount } = renderHook(() => useWakeLock())
    await act(async () => {})

    unmount()

    expect(sentinel.release).toHaveBeenCalledTimes(1)
  })

  it('releases the sentinel if the request resolves after unmount', async () => {
    const sentinel = { release: vi.fn() }
    let resolveRequest
    const request = vi
      .fn()
      .mockImplementationOnce(() => new Promise((resolve) => (resolveRequest = resolve)))
    navigator.wakeLock = { request }

    const { unmount } = renderHook(() => useWakeLock())

    // Unmount while the request is still in flight — nothing to release yet.
    unmount()

    await act(async () => {
      resolveRequest(sentinel)
    })

    expect(sentinel.release).toHaveBeenCalledTimes(1)
  })

  it('releases the previous sentinel before acquiring a new one on visibility regain', async () => {
    const firstSentinel = { release: vi.fn() }
    const secondSentinel = { release: vi.fn() }
    const request = vi
      .fn()
      .mockResolvedValueOnce(firstSentinel)
      .mockResolvedValueOnce(secondSentinel)
    navigator.wakeLock = { request }

    renderHook(() => useWakeLock())
    await act(async () => {})

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(firstSentinel.release).toHaveBeenCalledTimes(1)
    expect(secondSentinel.release).not.toHaveBeenCalled()
  })

  it('releases the first sentinel even when its request resolves after a second, newer acquire', async () => {
    const firstSentinel = { release: vi.fn() }
    const secondSentinel = { release: vi.fn() }
    let resolveFirst
    let resolveSecond
    const request = vi
      .fn()
      .mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)))
      .mockImplementationOnce(() => new Promise((resolve) => (resolveSecond = resolve)))
    navigator.wakeLock = { request }

    renderHook(() => useWakeLock())

    // Mount's acquire is still in flight (unresolved) when visibility regain
    // starts a second, overlapping acquire.
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    // The newer (second) request resolves first, the older (first) resolves
    // last — the out-of-order case the generation guard exists for.
    await act(async () => {
      resolveSecond(secondSentinel)
    })
    await act(async () => {
      resolveFirst(firstSentinel)
    })

    expect(firstSentinel.release).toHaveBeenCalledTimes(1)
    expect(secondSentinel.release).not.toHaveBeenCalled()
  })
})
