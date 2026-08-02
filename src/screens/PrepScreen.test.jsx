import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PrepScreen from './PrepScreen.jsx'
import { C2 } from '../data/timeline.js'
import { setItem } from '../services/storage.js'

const ONE_H_23_M_45_S_MS = ((1 * 60 + 23) * 60 + 45) * 1000

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

    expect(screen.getByText('T− 1:23:45')).toBeInTheDocument()
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
    expect(screen.getByText('T− 1:23:45')).toBeInTheDocument()

    setItem('eclipse.clockOffsetMs', 5000)
    // Force an immediate recompute without advancing the fake clock, so the
    // offset's effect is isolated from any elapsed-time artifact.
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(screen.getByText('T− 1:23:40')).toBeInTheDocument()
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

describe('PrepScreen reference card', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('is collapsed by default and reveals the exposure ladder text when expanded', () => {
    render(<PrepScreen />)

    const referenceCard = screen.getByText('Reference card').closest('details')
    expect(referenceCard).not.toHaveAttribute('open')

    expect(screen.queryByText(/Bracket \(C2\)/)).not.toBeVisible()

    referenceCard.setAttribute('open', '')

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

describe('PrepScreen settings composition', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('composes the settings panel, exposing the clock offset stepper', () => {
    render(<PrepScreen />)

    expect(screen.getByRole('button', { name: '+10s' })).toBeInTheDocument()
  })
})
