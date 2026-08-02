import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { unlockAudio } from '../services/audio.js'
import { audioStatusFromResult, useAudioUnlock } from './useAudioUnlock.js'

vi.mock('../services/audio.js', () => ({
  unlockAudio: vi.fn(),
}))

describe('audioStatusFromResult', () => {
  it('maps an ok result to "unlocked"', () => {
    expect(audioStatusFromResult({ ok: true })).toBe('unlocked')
  })

  it('maps a failed result to "failed"', () => {
    expect(audioStatusFromResult({ ok: false, reason: 'unsupported' })).toBe('failed')
  })
})

describe('useAudioUnlock', () => {
  beforeEach(() => {
    unlockAudio.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts at the given initial status without calling unlockAudio', () => {
    const { result } = renderHook(() => useAudioUnlock('failed'))

    expect(result.current.status).toBe('failed')
    expect(unlockAudio).not.toHaveBeenCalled()
  })

  it('defaults to "pending" when no initial status is given', () => {
    const { result } = renderHook(() => useAudioUnlock())

    expect(result.current.status).toBe('pending')
  })

  it('unlocks, transitions to "unlocked", and focuses contentRef on success', () => {
    unlockAudio.mockReturnValue({ ok: true })
    const { result } = renderHook(() => useAudioUnlock())

    const node = document.createElement('div')
    node.tabIndex = -1
    document.body.appendChild(node)
    result.current.contentRef.current = node

    act(() => result.current.unlock())

    expect(result.current.status).toBe('unlocked')
    expect(node).toHaveFocus()

    document.body.removeChild(node)
  })

  it('transitions to "failed" (not "unlocked") when unlockAudio fails', () => {
    unlockAudio.mockReturnValue({ ok: false, reason: 'unsupported' })
    const { result } = renderHook(() => useAudioUnlock())

    act(() => result.current.unlock())

    expect(result.current.status).toBe('failed')
  })
})
