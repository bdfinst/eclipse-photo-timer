import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PrepScreen from './PrepScreen.jsx'
import { C2 } from '../data/timeline.js'
import { setItem } from '../services/storage.js'
import { clockService } from '../services/clock.js'
import { resetRehearsalControlsState } from '../hooks/useRehearsalControls.js'

const ONE_H_23_M_45_S_MS = ((1 * 60 + 23) * 60 + 45) * 1000

// useRehearsalControls' paused/preSpeed tracking is module-level (session-
// scoped — see that hook's docstring), so it otherwise leaks across this
// file's several PrepScreen (and, with it, RehearsalPanel) mounts.
beforeEach(() => {
  resetRehearsalControlsState()
})

describe('PrepScreen header', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows a live countdown to C2', () => {
    vi.setSystemTime(Date.parse(C2) - ONE_H_23_M_45_S_MS)

    render(<PrepScreen />)

    expect(screen.getByText('T− 01:23:45')).toBeInTheDocument()
  })

  it('switches to a T+ elapsed display once C2 has passed (reachable via the "← Setup" button)', () => {
    vi.setSystemTime(Date.parse(C2) + ONE_H_23_M_45_S_MS)

    render(<PrepScreen />)

    expect(screen.getByText('T+ 01:23:45')).toBeInTheDocument()
  })

  it('shows a prominent GO LIVE button', () => {
    vi.setSystemTime(Date.parse(C2) - ONE_H_23_M_45_S_MS)

    render(<PrepScreen />)

    expect(screen.getByRole('button', { name: 'GO LIVE →' })).toBeInTheDocument()
  })

  // The plan's literal scenario (plans/eclipse-timer.md Slice 5 Step 5.1) states
  // this shift lands on "T− 1:23:50" (a +5s increase). That conflicts with the
  // already-committed, spec-authoritative formula `now() = Date.now() +
  // clockOffsetMs` (spec §3.1, verified by Slice 3's
  // "findActiveEvent clock-offset boundary shift" test): for a FUTURE event like
  // C2, increasing the offset increases `now()`, which *decreases* the
  // remaining `C2 - now()` delta. spec §14's AC only requires the countdown
  // "shifts... by 5 seconds" — it does not pin a direction. Corrected here to
  // "T− 1:23:40" (a -5s decrease) to match the verified formula, same as the
  // corrections already documented in useTimelineState.test.js.
  it('shifts the displayed countdown by exactly 5 seconds when a +5000ms clock offset is applied', () => {
    vi.setSystemTime(Date.parse(C2) - ONE_H_23_M_45_S_MS)

    render(<PrepScreen />)
    expect(screen.getByText('T− 01:23:45')).toBeInTheDocument()

    setItem('eclipse.clockOffsetMs', 5000)
    // Force an immediate recompute without advancing the fake clock, so the
    // offset's effect is isolated from any elapsed-time artifact.
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(screen.getByText('T− 01:23:40')).toBeInTheDocument()
  })
})

describe('PrepScreen GO LIVE gesture', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('calls onGoLive when tapped', () => {
    const onGoLive = vi.fn()
    render(<PrepScreen onGoLive={onGoLive} />)

    fireEvent.click(screen.getByRole('button', { name: 'GO LIVE →' }))

    expect(onGoLive).toHaveBeenCalledTimes(1)
  })
})

describe('PrepScreen hamburger menu', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('lists the three prep sections once opened, and closes via the close button', () => {
    render(<PrepScreen />)

    expect(screen.queryByRole('button', { name: 'Reference card' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Menu' }))

    expect(screen.getByRole('button', { name: 'Checklist' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reference card' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Rehearsal' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Close menu' }))

    expect(screen.queryByRole('button', { name: 'Reference card' })).not.toBeInTheDocument()
  })

  it('navigates to the checklist section and back home', () => {
    render(<PrepScreen />)

    fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
    fireEvent.click(screen.getByRole('button', { name: 'Checklist' }))

    // The section replaces the home hero — GO LIVE lives on home only.
    expect(screen.getByRole('button', { name: 'Reset all' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'GO LIVE →' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '← Home' }))

    expect(screen.getByRole('button', { name: 'GO LIVE →' })).toBeInTheDocument()
  })

  it('hands focus to the back button when re-selecting the already-open section', () => {
    render(<PrepScreen />)

    fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
    fireEvent.click(screen.getByRole('button', { name: 'Checklist' }))
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
    fireEvent.click(screen.getByRole('button', { name: 'Checklist' }))

    // The drawer (and the menu item that was just activated) unmounted —
    // without an explicit handoff, focus would silently drop to <body>.
    expect(screen.queryByRole('button', { name: 'Close menu' })).not.toBeInTheDocument()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '← Home' }))
  })

  it('closes the drawer on Escape', () => {
    render(<PrepScreen />)

    fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
    expect(screen.getByRole('button', { name: 'Close menu' })).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('button', { name: 'Close menu' })).not.toBeInTheDocument()
  })

  it('closes the settings modal first, then the drawer, when both are open', () => {
    render(<PrepScreen />)

    fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
    // The drawer has no focus trap, so the top-bar gear button stays
    // keyboard-reachable behind it — both overlays CAN be open at once,
    // and one Escape must dismiss only the topmost.
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('dialog', { name: 'Settings' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close menu' })).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('button', { name: 'Close menu' })).not.toBeInTheDocument()
  })
})

describe('PrepScreen reference card', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('is hidden until opened from the menu, then shows the exposure ladder text', () => {
    render(<PrepScreen />)

    expect(screen.queryByText(/Bracket \(C2\)/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reference card' }))

    expect(
      screen.getByText(
        'Bracket (C2): base 1/50 → 1/3200 · 1/800 · 1/200 · 1/50 · 1/13 · 0.3" · 1.3"',
      ),
    ).toBeInTheDocument()
    // Testing Library's default normalizer collapses runs of whitespace in
    // the rendered text content to a single space before matching — these
    // two matchers use single spaces for that reason, even though the
    // source constant (verbatim from spec §5.3) keeps the original spacing.
    expect(
      screen.getByText('Partial (C1, filter on): 1/400 | Diamond ring (C4): 1/2500'),
    ).toBeInTheDocument()
    expect(screen.getByText('Earthshine (C3, ISO 1600): 1.3" / 2.5" / 5"')).toBeInTheDocument()
    expect(
      screen.getByText('Zoom 250 = corona (2.8 × 3.8 Rs) · Zoom 500 = prominences (1.4 × 1.9 Rs)'),
    ).toBeInTheDocument()
  })
})

describe('PrepScreen settings modal', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('opens from the gear button, exposing the clock offset stepper, and closes again', () => {
    render(<PrepScreen />)

    expect(screen.queryByRole('button', { name: '+10s' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))

    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+10s' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Close settings' }))

    expect(screen.queryByRole('button', { name: '+10s' })).not.toBeInTheDocument()
  })

  it('closes on Escape', () => {
    render(<PrepScreen />)

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('dialog', { name: 'Settings' })).not.toBeInTheDocument()
  })
})

describe('PrepScreen setup status', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('shows 0% for every section with nothing checked', () => {
    render(<PrepScreen />)

    expect(screen.getByText('Setup status')).toBeInTheDocument()
    expect(screen.getByText('The night before')).toBeInTheDocument()
    // Four checklist groups, all untouched.
    expect(screen.getAllByText('0%')).toHaveLength(4)
  })

  it('shows the rounded per-section percentage for partially-checked groups', () => {
    // 1 of the 10 "night before" items — 10%; other groups untouched.
    setItem('eclipse.checklist', { 'night-battery': true })

    render(<PrepScreen />)

    expect(screen.getByText('10%')).toBeInTheDocument()
    expect(screen.getAllByText('0%')).toHaveLength(3)
  })

  it('navigates to the checklist when a status row is tapped', () => {
    render(<PrepScreen />)

    fireEvent.click(screen.getByRole('button', { name: /The night before/ }))

    expect(screen.getByRole('button', { name: 'Reset all' })).toBeInTheDocument()
  })
})

describe('PrepScreen rehearsal banner (spec §8)', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    clockService.clearVirtual()
  })

  it('shows no banner when rehearsal is off, and the striped banner once toggled on', () => {
    render(<PrepScreen />)

    expect(screen.queryByText('REHEARSAL — NOT LIVE')).not.toBeInTheDocument()

    // The rehearsal controls now live behind the hamburger menu.
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
    fireEvent.click(screen.getByRole('button', { name: 'Rehearsal' }))
    fireEvent.click(screen.getByLabelText('Rehearsal mode'))
    act(() => {
      vi.advanceTimersByTime(250)
    })

    expect(screen.getByText('REHEARSAL — NOT LIVE')).toBeInTheDocument()
  })

  it('shows a live clock readout on the rehearsal view that reflects a jump-to selection', () => {
    render(<PrepScreen />)

    fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
    fireEvent.click(screen.getByRole('button', { name: 'Rehearsal' }))
    fireEvent.click(screen.getByRole('button', { name: 'C1 −2 min' }))
    act(() => {
      vi.advanceTimersByTime(250)
    })

    // C1 (2026-08-12T16:47:00Z) − 2 min = 16:45:00 UTC, independently
    // hardcoded rather than derived from the timeline constant — the digit
    // wildcard absorbs the one tick of virtual time elapsed above. Without
    // the readout, a jump-to changed nothing visible on this view and read
    // as the selection silently failing.
    expect(screen.getByText(/16:45:0\d · T− 01:01:\d{2}/)).toBeInTheDocument()
  })
})
