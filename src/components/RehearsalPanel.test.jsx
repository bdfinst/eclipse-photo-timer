import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RehearsalPanel, { RehearsalBanner } from './RehearsalPanel.jsx'
import { clockService } from '../services/clock.js'
import { C1, C2, C3, C4 } from '../data/timeline.js'
import { resetAnnouncementState } from '../hooks/useAnnouncements.js'
import {
  resetRehearsalControlsState,
  resetRehearsalSession,
} from '../hooks/useRehearsalControls.js'

vi.mock('../hooks/useAnnouncements.js', () => ({
  resetAnnouncementState: vi.fn(),
}))

// useRehearsalControls' paused/preSpeed tracking is module-level (session-
// scoped — see that hook's docstring), so it otherwise leaks across this
// file's many independent renders. Reset before each test.
beforeEach(() => {
  resetRehearsalControlsState()
})

describe('RehearsalPanel toggle', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    clockService.clearVirtual()
  })

  it('starts unchecked when rehearsal is not active', () => {
    render(<RehearsalPanel />)

    expect(clockService.isRehearsal()).toBe(false)
    expect(screen.getByLabelText('Rehearsal mode')).not.toBeChecked()
  })

  it('arms the virtual clock at the current instant, 1x speed, when toggled on', () => {
    render(<RehearsalPanel />)

    fireEvent.click(screen.getByLabelText('Rehearsal mode'))

    expect(clockService.isRehearsal()).toBe(true)
    expect(screen.getByLabelText('Rehearsal mode')).toBeChecked()
  })

  it('clears the virtual clock when toggled off again', () => {
    render(<RehearsalPanel />)

    fireEvent.click(screen.getByLabelText('Rehearsal mode'))
    fireEvent.click(screen.getByLabelText('Rehearsal mode'))

    expect(clockService.isRehearsal()).toBe(false)
    expect(screen.getByLabelText('Rehearsal mode')).not.toBeChecked()
  })

  it("resets useAnnouncements' consumed-instant state when toggled off, since exiting rehearsal jumps the clock back to real time — the same kind of discontinuity as a jump-to", () => {
    resetAnnouncementState.mockClear()
    render(<RehearsalPanel />)

    fireEvent.click(screen.getByLabelText('Rehearsal mode'))
    resetAnnouncementState.mockClear() // toggling ON does not need to reset
    fireEvent.click(screen.getByLabelText('Rehearsal mode'))

    expect(resetAnnouncementState).toHaveBeenCalled()
  })

  it('arms at whatever speed was already selected, not a hardcoded 1x, so the persisted speed and the actual clock rate never desync', () => {
    localStorage.setItem('eclipse.rehearsalSpeed', '60')
    vi.useFakeTimers()

    try {
      render(<RehearsalPanel />)
      fireEvent.click(screen.getByLabelText('Rehearsal mode'))
      const armedAt = clockService.now()

      vi.advanceTimersByTime(1000)

      expect(clockService.now()).toBe(armedAt + 60_000)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe.each([
  ['C1 −2 min', Date.parse(C1) - 2 * 60 * 1000],
  ['C2 −5 min', Date.parse(C2) - 5 * 60 * 1000],
  ['C2 −30 s', Date.parse(C2) - 30 * 1000],
  ['C3 −20 s', Date.parse(C3) - 20 * 1000],
  ['C4 −1 min', Date.parse(C4) - 60 * 1000],
])('RehearsalPanel jump-to button %s', (label, target) => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
    clockService.clearVirtual()
  })

  it(`sets the virtual clock to ${label}'s target instant`, () => {
    render(<RehearsalPanel />)

    fireEvent.click(screen.getByRole('button', { name: label }))

    expect(clockService.isRehearsal()).toBe(true)
    expect(clockService.now()).toBe(target)
  })

  it("resets useAnnouncements' consumed-instant state, so a repeated rehearsal run through this same window fires again", () => {
    resetAnnouncementState.mockClear()
    render(<RehearsalPanel />)

    fireEvent.click(screen.getByRole('button', { name: label }))

    // Without this, a second jump into an already-rehearsed window would
    // silently announce nothing — every instant in it is already marked
    // consumed from the first run (useAnnouncements' consumed state is
    // session-scoped, not per-mount, so it survives between runs).
    expect(resetAnnouncementState).toHaveBeenCalled()
  })

  it(`highlights ${label} as the selected starting point after tapping it`, () => {
    render(<RehearsalPanel />)

    fireEvent.click(screen.getByRole('button', { name: label }))

    expect(screen.getByRole('button', { name: label })).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('RehearsalPanel jump-to selection highlight', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
    clockService.clearVirtual()
  })

  it('starts with no jump target highlighted', () => {
    render(<RehearsalPanel />)

    expect(screen.getByRole('button', { name: 'C1 −2 min' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('moves the highlight when a different starting point is tapped', () => {
    render(<RehearsalPanel />)

    fireEvent.click(screen.getByRole('button', { name: 'C1 −2 min' }))
    fireEvent.click(screen.getByRole('button', { name: 'C3 −20 s' }))

    expect(screen.getByRole('button', { name: 'C1 −2 min' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(screen.getByRole('button', { name: 'C3 −20 s' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('keeps the highlight across an unmount/remount while rehearsal keeps running', () => {
    // The "← Setup"/GO LIVE round trip unmounts and remounts this panel
    // while the clock keeps playing from the selected starting point — the
    // highlight must survive it, like paused/preSpeed do.
    const { unmount } = render(<RehearsalPanel />)
    fireEvent.click(screen.getByRole('button', { name: 'C2 −5 min' }))

    unmount()
    render(<RehearsalPanel />)

    expect(screen.getByRole('button', { name: 'C2 −5 min' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('clears the highlight on Reset to real time', () => {
    render(<RehearsalPanel />)

    fireEvent.click(screen.getByRole('button', { name: 'C1 −2 min' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reset to real time' }))

    expect(screen.getByRole('button', { name: 'C1 −2 min' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('clears the highlight when rehearsal mode is toggled off', () => {
    render(<RehearsalPanel />)

    fireEvent.click(screen.getByRole('button', { name: 'C1 −2 min' }))
    fireEvent.click(screen.getByLabelText('Rehearsal mode'))

    expect(screen.getByRole('button', { name: 'C1 −2 min' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })
})

describe('RehearsalPanel speed control', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
    clockService.clearVirtual()
  })

  it('advances the virtual clock 10 simulated seconds per real second once 10x is selected', () => {
    clockService.setVirtual(Date.parse(C2), 1)
    render(<RehearsalPanel />)

    fireEvent.click(screen.getByRole('button', { name: '10×' }))
    vi.advanceTimersByTime(1000)

    expect(clockService.now()).toBe(Date.parse(C2) + 10_000)
  })

  it('persists the selected speed to storage', () => {
    render(<RehearsalPanel />)

    fireEvent.click(screen.getByRole('button', { name: '60×' }))

    expect(JSON.parse(localStorage.getItem('eclipse.rehearsalSpeed'))).toBe(60)
  })
})

describe('RehearsalPanel pause, resume, and reset', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
    clockService.clearVirtual()
  })

  it('stops the virtual clock on pause, continues from the same instant on resume', () => {
    clockService.setVirtual(Date.parse(C2), 1)
    render(<RehearsalPanel />)

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    vi.advanceTimersByTime(5000)
    const pausedAt = clockService.now()
    expect(pausedAt).toBe(Date.parse(C2))

    fireEvent.click(screen.getByRole('button', { name: 'Resume' }))
    vi.advanceTimersByTime(1000)

    expect(clockService.now()).toBe(pausedAt + 1000)
  })

  it('checks the rehearsal-mode toggle if Pause is tapped before rehearsal was ever turned on', () => {
    render(<RehearsalPanel />)
    expect(screen.getByLabelText('Rehearsal mode')).not.toBeChecked()

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))

    expect(screen.getByLabelText('Rehearsal mode')).toBeChecked()
  })

  it('returns to the real clock on reset, so isRehearsal() is false and now() tracks Date.now()', () => {
    clockService.setVirtual(Date.parse(C2), 1)
    render(<RehearsalPanel />)

    fireEvent.click(screen.getByRole('button', { name: 'Reset to real time' }))

    expect(clockService.isRehearsal()).toBe(false)
  })

  it("resets useAnnouncements' consumed-instant state on reset, for the same reason as toggling off", () => {
    clockService.setVirtual(Date.parse(C2), 1)
    resetAnnouncementState.mockClear()
    render(<RehearsalPanel />)

    fireEvent.click(screen.getByRole('button', { name: 'Reset to real time' }))

    expect(resetAnnouncementState).toHaveBeenCalled()
  })

  it('resumes at a previously-selected non-default speed, not always 1x', () => {
    clockService.setVirtual(Date.parse(C2), 1)
    render(<RehearsalPanel />)

    fireEvent.click(screen.getByRole('button', { name: '10×' }))
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    vi.advanceTimersByTime(5000)
    const pausedAt = clockService.now()

    fireEvent.click(screen.getByRole('button', { name: 'Resume' }))
    vi.advanceTimersByTime(1000)

    expect(clockService.now()).toBe(pausedAt + 10_000)
  })

  it('still shows Resume (not Pause) and restores the correct pre-pause speed after the panel unmounts and remounts while paused', () => {
    // Regression test: the "← Setup" button (App.jsx) unmounts RehearsalPanel
    // on GO LIVE and remounts it on return, while the clock itself stays
    // exactly as the operator left it. A plain per-mount useState here would
    // forget both that it was paused and at what speed to resume.
    clockService.setVirtual(Date.parse(C2), 1)
    const { unmount } = render(<RehearsalPanel />)

    fireEvent.click(screen.getByRole('button', { name: '10×' }))
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    const pausedAt = clockService.now()

    unmount()
    render(<RehearsalPanel />)

    expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Resume' }))
    vi.advanceTimersByTime(1000)

    expect(clockService.now()).toBe(pausedAt + 10_000)
  })

  it('un-pauses (shows Pause, not Resume) after jumping to a target while paused', () => {
    clockService.setVirtual(Date.parse(C2), 1)
    render(<RehearsalPanel />)

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'C3 −20 s' }))

    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Resume' })).not.toBeInTheDocument()

    // The clock must actually be moving post-jump, not just the UI relabelled.
    const afterJump = clockService.now()
    vi.advanceTimersByTime(1000)
    expect(clockService.now()).toBe(afterJump + 1000)
  })

  it('selecting a new speed while paused records it for the next Resume, without silently un-pausing', () => {
    clockService.setVirtual(Date.parse(C2), 1)
    render(<RehearsalPanel />)

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    const pausedAt = clockService.now()

    fireEvent.click(screen.getByRole('button', { name: '10×' }))

    // Still paused — the clock must not have moved, and the button must
    // still read "Resume".
    expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument()
    vi.advanceTimersByTime(1000)
    expect(clockService.now()).toBe(pausedAt)

    fireEvent.click(screen.getByRole('button', { name: 'Resume' }))
    vi.advanceTimersByTime(1000)

    expect(clockService.now()).toBe(pausedAt + 10_000)
  })
})

describe('resetRehearsalSession', () => {
  afterEach(() => {
    clockService.clearVirtual()
  })

  it('ends an active rehearsal: real clock restored, announcement state reset', () => {
    clockService.setVirtual(Date.parse(C2), 1)
    resetAnnouncementState.mockClear()

    resetRehearsalSession()

    expect(clockService.isRehearsal()).toBe(false)
    expect(resetAnnouncementState).toHaveBeenCalled()
  })

  it('is a strict no-op outside rehearsal — a real-session detour must never clear announcement state', () => {
    resetAnnouncementState.mockClear()

    resetRehearsalSession()

    expect(clockService.isRehearsal()).toBe(false)
    expect(resetAnnouncementState).not.toHaveBeenCalled()
  })
})

// RehearsalBanner is a pure, stateless read of clockService.isRehearsal() —
// exercised here as "renders correctly for a given clock state at mount".
// The "toggling makes it appear on an already-mounted screen" behavior is
// covered in PrepScreen.test.jsx / LiveScreen.test.jsx, since those screens
// (not this component in isolation) are what re-render it on a tick.
describe('RehearsalBanner', () => {
  afterEach(() => {
    clockService.clearVirtual()
  })

  it('renders nothing when rehearsal is not active', () => {
    render(<RehearsalBanner />)

    expect(screen.queryByText('REHEARSAL — NOT LIVE')).not.toBeInTheDocument()
  })

  it('renders the striped banner text when rehearsal is active', () => {
    clockService.setVirtual(clockService.now(), 1)

    render(<RehearsalBanner />)

    expect(screen.getByText('REHEARSAL — NOT LIVE')).toBeInTheDocument()
  })
})
