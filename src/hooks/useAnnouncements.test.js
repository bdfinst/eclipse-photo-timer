import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getScheduledInstants,
  resetAnnouncementState,
  useAnnouncements,
} from './useAnnouncements.js'
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
    // Consumed/first-tick state is module-level (session-scoped, not tied
    // to a single hook instance — see useAnnouncements.js's docstring), so
    // each test must start from a clean slate independent of the others.
    resetAnnouncementState()
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

  it('still fires an instant that became due while unmounted (e.g. the operator went back to the prep screen and returned), rather than treating the remount as a fresh catch-up', () => {
    // Mount well before c1's lead instant (16:46:50Z) — nothing due yet, and
    // this mount's own first tick establishes "session has ticked" so a
    // LATER remount is not itself treated as catch-up.
    const { unmount } = renderAnnouncements(Date.parse('2026-08-12T16:46:00Z'))
    expect(speak).not.toHaveBeenCalled()

    // Simulates navigating away (App.jsx's "← Setup" button unmounts
    // LiveScreen) and back (GO LIVE remounts it) — a brand new hook
    // instance, not just a rerender of the same one.
    unmount()

    // Remounts AFTER c1's lead instant has already passed while "off-screen".
    // A useRef-based (per-mount) implementation would wrongly treat this as
    // a fresh mount-time catch-up and swallow it; the module-level state
    // must still fire it, since the whole SESSION already ticked once.
    renderAnnouncements(Date.parse('2026-08-12T16:47:00Z'))

    expect(speak).toHaveBeenCalledWith('First contact. Start the timer now.')
  })

  it('does not burst-fire an instant that has been stale for more than 30s by the time of remount', () => {
    // Same shape as the previous test, but the detour is much longer: c1's
    // lead instant (16:46:50Z) is 40s stale by the time of remount
    // (16:47:30Z) — well past MAX_STALE_MS. A long-detour return should not
    // dump a backlog of stale reminders; this instant is treated as missed.
    const { unmount } = renderAnnouncements(Date.parse('2026-08-12T16:46:00Z'))
    expect(speak).not.toHaveBeenCalled()

    unmount()
    renderAnnouncements(Date.parse('2026-08-12T16:47:30Z'))

    expect(speak).not.toHaveBeenCalledWith('First contact. Start the timer now.')
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

  it('scales the staleness bound by rehearsal speed, so a round trip that only takes a few real seconds still fires at 2x', () => {
    // At 2x, MAX_STALE_MS (30s real) scales to 60s of virtual staleness.
    // Uses speed 2 (not a higher speed like 10x) deliberately: above 2x,
    // speech is ALSO suppressed by the separate "above 2x" rule (spec §8)
    // regardless of staleness, which would confound a speak assertion here.
    // Asserts on "Arm the timer" specifically (arm's lead instant, unique
    // text — unlike the 'critical-due'/'critical-warning' cue strings,
    // which several critical events share, this can't be produced by any
    // other event firing nearby) and stays well before c1 (16:47:00Z, 2
    // minutes after arm) so no other event's own instants are due yet.
    localStorage.clear()
    setItem(REHEARSAL_SPEED_KEY, 2)
    clockService.setVirtual(ARM_AT - 10_001, 2)

    const { unmount } = renderAnnouncements(ARM_AT - 10_001)
    expect(speak).not.toHaveBeenCalled()

    unmount()
    // Lead instant (ARM_AT - 10s) is 50s stale here — within the 60s bound.
    renderAnnouncements(ARM_AT - 10_000 + 50_000)

    expect(speak).toHaveBeenCalledWith('Arm the timer')
  })

  it('still bounds staleness at 2x once the virtual-time equivalent exceeds 30 real seconds', () => {
    // Same shape, but 70s stale — over the 60s scaled bound (~35 real
    // seconds away, no longer "a quick check") — and still before c1.
    localStorage.clear()
    setItem(REHEARSAL_SPEED_KEY, 2)
    clockService.setVirtual(ARM_AT - 10_001, 2)

    const { unmount } = renderAnnouncements(ARM_AT - 10_001)
    expect(speak).not.toHaveBeenCalled()

    unmount()
    renderAnnouncements(ARM_AT - 10_000 + 70_000)

    expect(speak).not.toHaveBeenCalledWith('Arm the timer')
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

describe('getScheduledInstants contract', () => {
  const baseEvent = { id: 'x', at: '2026-08-12T12:00:00Z', critical: false, title: 'X title' }

  it('honors an explicit leadSeconds override on a non-critical event, speaking its override text', () => {
    const instants = getScheduledInstants({ ...baseEvent, leadSeconds: 20, speak: 'Custom line' })

    expect(instants[0]).toMatchObject({
      key: 'x:lead',
      offsetSeconds: 20,
      type: 'speak',
      text: 'Custom line',
    })
  })

  it('honors an explicit leadSeconds override on a critical event, replacing the 10s default', () => {
    const lead = getScheduledInstants({ ...baseEvent, critical: true, leadSeconds: 3 }).find(
      (instant) => instant.key === 'x:lead',
    )

    expect(lead.offsetSeconds).toBe(3)
  })

  it("schedules exactly one 'non-critical-due' tone for a default non-critical event", () => {
    expect(getScheduledInstants(baseEvent)).toEqual([
      { key: 'x:due', offsetSeconds: 0, type: 'tone', cue: 'non-critical-due' },
    ])
  })

  it('schedules the ten warning blips as critical-warning tone instants', () => {
    const warns = getScheduledInstants({ ...baseEvent, critical: true }).filter((instant) =>
      instant.key.startsWith('x:warn:'),
    )

    expect(warns).toHaveLength(10)
    for (const warn of warns) {
      expect(warn).toMatchObject({ type: 'tone', cue: 'critical-warning' })
    }
  })

  it("cues 'critical-due' for a critical event that is not c2/c3", () => {
    const due = getScheduledInstants({ ...baseEvent, critical: true }).find(
      (instant) => instant.key === 'x:due',
    )

    expect(due.cue).toBe('critical-due')
  })

  it('cues the filter-toggle sweep for BOTH the c2 and c3 due instants', () => {
    for (const id of ['c2', 'c3']) {
      const due = getScheduledInstants({ ...baseEvent, id, critical: true }).find(
        (instant) => instant.key === `${id}:due`,
      )

      expect(due.cue).toBe('filter-toggle')
    }
  })
})

describe('useAnnouncements staleness boundary', () => {
  beforeEach(() => {
    speak.mockClear()
    playTone.mockClear()
    resetAnnouncementState()
  })

  afterEach(() => {
    clockService.clearVirtual()
  })

  it('still fires an instant that is EXACTLY the 30s staleness bound old on remount — only MORE stale is treated as missed', () => {
    // Kills the > vs >= boundary mutant: the docstring says "an instant
    // MORE than this stale ... is treated like a catch-up instant", so
    // exactly-at-the-bound must still fire.
    const LEAD_AT = ARM_AT - 10_000
    const first = renderAnnouncements(LEAD_AT - 1_000)
    first.unmount()

    renderAnnouncements(LEAD_AT + 30_000)

    expect(speak).toHaveBeenCalledWith('Arm the timer')
  })
})
