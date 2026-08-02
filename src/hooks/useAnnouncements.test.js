import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getScheduledInstants, useAnnouncements } from './useAnnouncements.js'
import { speak, playTone } from '../services/audio.js'
import { setItem } from '../services/storage.js'
import { clockService, REHEARSAL_SPEED_KEY } from '../services/clock.js'

vi.mock('../services/audio.js', () => ({
  speak: vi.fn(),
  playTone: vi.fn(),
}))

// 'arm' (spec/data/timeline.js): critical, no leadSeconds override, no
// speak override — so its lead-voice text falls back to its title.
const ARM_AT = Date.parse('2026-08-12T16:45:00Z')

function renderAnnouncements(initialNow, { master = true, voice = true, tones = true } = {}) {
  return renderHook(({ now, master: m, voice: v, tones: t }) => useAnnouncements(now, m, v, t), {
    initialProps: { now: initialNow, master, voice, tones },
  })
}

describe('useAnnouncements', () => {
  beforeEach(() => {
    speak.mockClear()
    playTone.mockClear()
  })

  afterEach(() => {
    clockService.clearVirtual()
  })

  it('fires the critical lead-time announcement and the T-5 bare countdown exactly once each', () => {
    const { rerender } = renderAnnouncements(ARM_AT - 10_001)

    act(() => rerender({ now: ARM_AT - 10_000, master: true, voice: true, tones: true }))
    expect(speak).toHaveBeenCalledTimes(1)
    expect(speak).toHaveBeenCalledWith('Arm the timer')

    act(() => rerender({ now: ARM_AT - 5_000, master: true, voice: true, tones: true }))
    expect(speak).toHaveBeenCalledTimes(2)
    expect(speak).toHaveBeenLastCalledWith('five seconds')
  })

  it('plays a single 660Hz-cue tone with no speech when a non-critical event becomes due (default zero lead)', () => {
    const CHECK1_AT = Date.parse('2026-08-12T17:00:00Z')
    const { rerender } = renderAnnouncements(CHECK1_AT - 1)

    act(() => rerender({ now: CHECK1_AT, master: true, voice: true, tones: true }))

    expect(playTone).toHaveBeenCalledTimes(1)
    expect(playTone).toHaveBeenCalledWith('non-critical-due')
    expect(speak).not.toHaveBeenCalled()
  })

  it('suppresses both speech and tones when the master audio setting is off', () => {
    const { rerender } = renderAnnouncements(ARM_AT - 10_001, { master: false })

    act(() => rerender({ now: ARM_AT - 10_000, master: false, voice: true, tones: true }))

    expect(speak).not.toHaveBeenCalled()
    expect(playTone).not.toHaveBeenCalled()
  })

  it('suppresses speech only (tones still fire) when the voice setting is off', () => {
    const { rerender } = renderAnnouncements(ARM_AT - 10_001, { voice: false })

    act(() => rerender({ now: ARM_AT - 10_000, master: true, voice: false, tones: true }))

    expect(speak).not.toHaveBeenCalled()
    expect(playTone).toHaveBeenCalledWith('critical-warning')
  })

  it('suppresses tones only (speech still fires) when the tones setting is off', () => {
    const { rerender } = renderAnnouncements(ARM_AT - 10_001, { tones: false })

    act(() => rerender({ now: ARM_AT - 10_000, master: true, voice: true, tones: false }))

    expect(speak).toHaveBeenCalledWith('Arm the timer')
    expect(playTone).not.toHaveBeenCalled()
  })

  it('marks a setting-suppressed instant consumed, so re-enabling the setting later never replays it', () => {
    const { rerender } = renderAnnouncements(ARM_AT - 10_001, { voice: false })

    act(() => rerender({ now: ARM_AT - 10_000, master: true, voice: false, tones: true }))
    expect(speak).not.toHaveBeenCalled()

    act(() => rerender({ now: ARM_AT - 10_000, master: true, voice: true, tones: true }))
    expect(speak).not.toHaveBeenCalled()
  })

  it('plays the filter-toggle sweep instead of critical-due when c2 becomes due', () => {
    const C2_AT = Date.parse('2026-08-12T17:46:10Z')
    const { rerender } = renderAnnouncements(C2_AT - 1)

    act(() => rerender({ now: C2_AT, master: true, voice: true, tones: true }))

    expect(playTone).toHaveBeenCalledWith('filter-toggle')
    expect(playTone).not.toHaveBeenCalledWith('critical-due')
  })

  it('never announces instants already in the past when the hook mounts mid-sequence', () => {
    // Mounts after 'arm' (16:45:00Z) has fully completed, but before c1's
    // (16:47:00Z) own lead instant (16:46:50Z, default 10s critical lead).
    const MOUNT_AT = Date.parse('2026-08-12T16:46:00Z')
    const { rerender } = renderAnnouncements(MOUNT_AT)

    expect(speak).not.toHaveBeenCalled()
    expect(playTone).not.toHaveBeenCalled()

    act(() =>
      rerender({
        now: Date.parse('2026-08-12T16:46:50Z'),
        master: true,
        voice: true,
        tones: true,
      }),
    )

    expect(speak).toHaveBeenCalledWith('First contact. Start the timer now.')
  })

  it('suppresses speak() but still plays the tone above 2x rehearsal speed (spec §8)', () => {
    localStorage.clear()
    setItem(REHEARSAL_SPEED_KEY, 10)
    clockService.setVirtual(ARM_AT - 10_001, 10)

    const { rerender } = renderAnnouncements(ARM_AT - 10_001)

    // 'arm''s lead-voice instant (T-10, a speak instant) is reached.
    act(() => rerender({ now: ARM_AT - 10_000, master: true, voice: true, tones: true }))
    expect(speak).not.toHaveBeenCalled()

    // 'arm''s T-5 warning tone instant is also reached — tones still fire.
    act(() => rerender({ now: ARM_AT - 5_000, master: true, voice: true, tones: true }))
    expect(speak).not.toHaveBeenCalled()
    expect(playTone).toHaveBeenCalled()
  })

  it('still speaks at exactly 2x rehearsal speed', () => {
    localStorage.clear()
    setItem(REHEARSAL_SPEED_KEY, 2)
    clockService.setVirtual(ARM_AT - 10_001, 2)

    const { rerender } = renderAnnouncements(ARM_AT - 10_001)

    act(() => rerender({ now: ARM_AT - 10_000, master: true, voice: true, tones: true }))

    expect(speak).toHaveBeenCalledWith('Arm the timer')
  })

  it('never suppresses speech on the real (non-rehearsal) clock, even if a stale rehearsal speed is still persisted from an earlier session', () => {
    localStorage.clear()
    // Simulates the exact bug this guards against: the operator rehearsed
    // at 10x earlier, then the app is used live — nothing ever clears this
    // key, so it would still read 10 here were it not gated on isRehearsal().
    setItem(REHEARSAL_SPEED_KEY, 10)
    expect(clockService.isRehearsal()).toBe(false)

    const { rerender } = renderAnnouncements(ARM_AT - 10_001)

    act(() => rerender({ now: ARM_AT - 10_000, master: true, voice: true, tones: true }))

    expect(speak).toHaveBeenCalledWith('Arm the timer')
  })
})

describe('getScheduledInstants', () => {
  it('schedules only a due instant for a non-critical event with the default zero lead', () => {
    const instants = getScheduledInstants({
      id: 'x',
      at: '2026-01-01T00:00:00Z',
      critical: false,
      title: 'X',
    })

    expect(instants).toHaveLength(1)
    expect(instants[0]).toMatchObject({ key: 'x:due', type: 'tone', cue: 'non-critical-due' })
  })

  it('schedules lead + five-second + 10 warning tones + due for a critical event', () => {
    const instants = getScheduledInstants({
      id: 'y',
      at: '2026-01-01T00:00:00Z',
      critical: true,
      title: 'Y',
    })

    // 1 lead + 1 five-second + 10 warning tones (T-10..T-1) + 1 due = 13.
    expect(instants).toHaveLength(13)
    expect(instants.map((instant) => instant.key)).toContain('y:lead')
    expect(instants.map((instant) => instant.key)).toContain('y:five')
  })

  it('overrides the due cue to filter-toggle for c2 and c3', () => {
    const c2Instants = getScheduledInstants({
      id: 'c2',
      at: '2026-01-01T00:00:00Z',
      critical: true,
      title: 'Z',
    })

    expect(c2Instants.find((instant) => instant.key === 'c2:due').cue).toBe('filter-toggle')
  })
})
