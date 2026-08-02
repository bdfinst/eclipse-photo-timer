import { afterEach, describe, expect, it, vi } from 'vitest'
import { requestWakeLock } from './wakelock.js'

describe('wakelock: requestWakeLock', () => {
  afterEach(() => {
    delete navigator.wakeLock
  })

  it('resolves { ok: true, sentinel } when the request succeeds', async () => {
    const sentinel = { release: vi.fn() }
    navigator.wakeLock = { request: vi.fn().mockResolvedValue(sentinel) }

    const result = await requestWakeLock()

    expect(navigator.wakeLock.request).toHaveBeenCalledWith('screen')
    expect(result).toEqual({ ok: true, sentinel })
  })

  it('resolves { ok: false, reason: "unsupported" } when navigator.wakeLock is undefined', async () => {
    delete navigator.wakeLock

    const result = await requestWakeLock()

    expect(result).toEqual({ ok: false, reason: 'unsupported' })
  })

  it('resolves { ok: false, reason } when the request rejects', async () => {
    navigator.wakeLock = { request: vi.fn().mockRejectedValue(new Error('denied')) }

    const result = await requestWakeLock()

    expect(result).toEqual({ ok: false, reason: 'denied' })
  })
})
