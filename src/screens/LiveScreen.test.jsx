import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LiveScreen from './LiveScreen.jsx'
import { setItem } from '../services/storage.js'
import { clockService } from '../services/clock.js'
import { C2, C3 } from '../data/timeline.js'
import { unlockAudio, speak, playTone } from '../services/audio.js'
import { resetAnnouncementState } from '../hooks/useAnnouncements.js'

vi.mock('../services/audio.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    unlockAudio: vi.fn(() => ({ ok: false, reason: 'unsupported' })),
    speak: vi.fn(),
    playTone: vi.fn(),
  }
})

// useAnnouncements' consumed/first-tick state is deliberately module-level
// (session-scoped, so a real back-to-prep-and-return round trip doesn't
// re-trigger mount-time catch-up — see that hook's docstring), which means
// it otherwise leaks across every test in this file. Reset before each one
// so each test's own announcement assertions start from a clean slate.
beforeEach(() => {
  resetAnnouncementState()
})

describe('LiveScreen filter banner', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    // Stub a successful wake lock so the wake-lock warning chip (also
    // role="alert") never renders alongside the filter banner — otherwise
    // getByRole('alert') would match two elements once that async state
    // settles.
    navigator.wakeLock = { request: vi.fn().mockResolvedValue({ release: vi.fn() }) }
  })

  afterEach(() => {
    vi.useRealTimers()
    delete navigator.wakeLock
    vi.restoreAllMocks()
  })

  it('reflects the most recent filterOn value: FILTER OFF — DO NOT LOOK during totality', () => {
    // c2 (17:46:10Z) sets filterOn: false and stays false until c3 (17:48:13Z).
    vi.setSystemTime(Date.parse('2026-08-12T17:46:20Z'))

    render(<LiveScreen />)

    expect(screen.getByRole('alert')).toHaveTextContent('FILTER OFF — DO NOT LOOK')
  })

  it('shows FILTER ON before totality', () => {
    // arm (16:45:00Z) sets filterOn: true.
    vi.setSystemTime(Date.parse('2026-08-12T16:46:00Z'))

    render(<LiveScreen />)

    expect(screen.getByRole('status')).toHaveTextContent('FILTER ON')
  })
})

describe('LiveScreen current-time row', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows a non-zero offset annotation alongside HH:MM:SS', () => {
    vi.setSystemTime(Date.parse('2026-08-12T16:46:00Z'))
    setItem('eclipse.clockOffsetMs', 3000)

    render(<LiveScreen />)

    expect(screen.getByText('16:46:03')).toBeInTheDocument()
    expect(screen.getByText('(+3s)')).toBeInTheDocument()
  })

  it('shows no offset annotation when the offset is zero', () => {
    vi.setSystemTime(Date.parse('2026-08-12T16:46:00Z'))

    render(<LiveScreen />)

    expect(screen.getByText('16:46:00')).toBeInTheDocument()
    expect(screen.queryByText(/^\(.*s\)$/)).not.toBeInTheDocument()
  })

  it('shows no offset annotation during rehearsal, since the stored offset is never applied to the virtual clock', () => {
    vi.setSystemTime(Date.parse('2026-08-12T16:46:00Z'))
    setItem('eclipse.clockOffsetMs', 3000)
    clockService.setVirtual(Date.parse('2026-08-12T16:46:00Z'), 1)

    try {
      render(<LiveScreen />)

      expect(screen.queryByText(/^\(.*s\)$/)).not.toBeInTheDocument()
    } finally {
      clockService.clearVirtual()
    }
  })
})

describe('LiveScreen next-action countdown', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('reads "T− 00:00:42" when the next event is 42 seconds away', () => {
    // "arm" is at 16:45:00Z — 42s before is 16:44:18Z.
    vi.setSystemTime(Date.parse('2026-08-12T16:44:18Z'))

    render(<LiveScreen />)
    // "Arm the timer" also appears as its own card in the scrolling event
    // list below (Slice 8) — scope to the NextAction region for uniqueness.
    const nextAction = within(screen.getByTestId('next-action'))

    expect(nextAction.getByText('Arm the timer')).toBeInTheDocument()
    expect(nextAction.getByText('T− 00:00:42')).toBeInTheDocument()
  })

  it('switches to a large single number when the next event is 7 seconds away', () => {
    // "arm" is at 16:45:00Z — 7s before is 16:44:53Z.
    vi.setSystemTime(Date.parse('2026-08-12T16:44:53Z'))

    render(<LiveScreen />)
    // Scoped to NextAction: the scrolling event list (Slice 8) also renders
    // "T− "-prefixed relative labels for every other future card.
    const nextAction = within(screen.getByTestId('next-action'))

    expect(nextAction.getByText('7')).toBeInTheDocument()
    expect(nextAction.queryByText(/T− /)).not.toBeInTheDocument()
  })
})

describe('LiveScreen wake lock', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(Date.parse('2026-08-12T16:46:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    delete navigator.wakeLock
    vi.restoreAllMocks()
  })

  it('requests the wake lock on mount and shows no warning chip on success', async () => {
    navigator.wakeLock = { request: vi.fn().mockResolvedValue({ release: vi.fn() }) }

    render(<LiveScreen />)
    await act(async () => {})

    expect(navigator.wakeLock.request).toHaveBeenCalledWith('screen')
    expect(screen.queryByText(/auto-lock/i)).not.toBeInTheDocument()
  })

  it('shows a warning chip when the wake lock is unavailable', async () => {
    delete navigator.wakeLock

    render(<LiveScreen />)
    await act(async () => {})

    expect(screen.getByText(/set auto-lock to never/i)).toBeInTheDocument()
  })
})

describe('LiveScreen audio unlock overlay', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(Date.parse('2026-08-12T16:46:00Z'))
    navigator.wakeLock = { request: vi.fn().mockResolvedValue({ release: vi.fn() }) }
    unlockAudio.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
    delete navigator.wakeLock
    vi.restoreAllMocks()
  })

  it('shows a tap-to-enable-audio overlay by default, without hiding existing content', () => {
    render(<LiveScreen />)

    expect(screen.getByText('Tap to enable audio')).toBeInTheDocument()
    expect(screen.getByTestId('event-list')).toBeInTheDocument()
  })

  it('unlocks audio, dismisses the overlay, and moves focus to the primary content on tap', () => {
    unlockAudio.mockReturnValue({ ok: true })

    render(<LiveScreen />)
    fireEvent.click(screen.getByText('Tap to enable audio'))

    expect(unlockAudio).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Tap to enable audio')).not.toBeInTheDocument()
    expect(screen.getByTestId('live-content')).toHaveFocus()
  })

  it('does not show the overlay when a prior GO LIVE unlock gesture already happened', () => {
    render(<LiveScreen initialAudioStatus="unlocked" />)

    expect(screen.queryByText('Tap to enable audio')).not.toBeInTheDocument()
  })
})

describe('LiveScreen audio unlock failure warning', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(Date.parse('2026-08-12T16:46:00Z'))
    navigator.wakeLock = { request: vi.fn().mockResolvedValue({ release: vi.fn() }) }
  })

  afterEach(() => {
    vi.useRealTimers()
    delete navigator.wakeLock
    vi.restoreAllMocks()
  })

  it('shows a persistent warning chip when GO LIVE already attempted unlock and failed', () => {
    render(<LiveScreen initialAudioStatus="failed" />)

    expect(screen.getByText(/audio confirmation could not be verified/i)).toBeInTheDocument()
    expect(screen.queryByText('Tap to enable audio')).not.toBeInTheDocument()
  })

  it('shows the warning chip when the tap-to-enable gesture itself fails', () => {
    unlockAudio.mockReturnValue({ ok: false, reason: 'unsupported' })

    render(<LiveScreen />)
    fireEvent.click(screen.getByText('Tap to enable audio'))

    expect(screen.getByText(/audio confirmation could not be verified/i)).toBeInTheDocument()
  })
})

// The 9 phase==='totality' events (spec §6.3) plus the c3 filter-on card,
// in EVENTS order.
const TOTALITY_BLOCK_IDS = [
  'c2',
  'burst-1',
  'earth-1',
  'burst-2',
  'earth-2',
  'lookup',
  'burst-3',
  'earth-3',
  'arm-c3',
  'c3',
]

describe('LiveScreen totality compact block', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    navigator.wakeLock = { request: vi.fn().mockResolvedValue({ release: vi.fn() }) }
  })

  afterEach(() => {
    vi.useRealTimers()
    delete navigator.wakeLock
    vi.restoreAllMocks()
  })

  it('renders exactly the 10 totality-block cards, compact, once C2 is next up', () => {
    // final-check (17:45:40Z) is active, c2 (17:46:10Z) is next — the block
    // must already be visible before C2 actually fires.
    vi.setSystemTime(Date.parse('2026-08-12T17:45:45Z'))

    render(<LiveScreen />)

    const block = screen.getByTestId('totality-block')
    const cards = block.querySelectorAll('[data-testid="event-card"]')

    expect(cards).toHaveLength(10)
    expect([...cards].map((card) => card.dataset.eventId)).toEqual(TOTALITY_BLOCK_IDS)
  })

  it('keeps the block visible while c3 (the last block event) is still active', () => {
    // c3 (17:48:13Z) active, ramp-down-1 (17:49:15Z) next — neither of
    // which is itself in the totality-phase list, but c3 is the trailing
    // filter-on card the block must still show.
    vi.setSystemTime(Date.parse('2026-08-12T17:48:20Z'))

    render(<LiveScreen />)

    expect(screen.getByTestId('totality-block')).toBeInTheDocument()
  })

  it('does not render the block well before or after the totality window', () => {
    vi.setSystemTime(Date.parse('2026-08-12T17:00:00Z'))

    render(<LiveScreen />)

    expect(screen.queryByTestId('totality-block')).not.toBeInTheDocument()
  })

  it('hides the block once the timeline has moved past c3', () => {
    // ramp-down-1 (17:49:15Z) active, ramp-down-2 (17:51:30Z) next.
    vi.setSystemTime(Date.parse('2026-08-12T17:49:20Z'))

    render(<LiveScreen />)

    expect(screen.queryByTestId('totality-block')).not.toBeInTheDocument()
  })

  // jsdom performs no real layout, so "fits on one screen" (spec §13 item 7)
  // cannot be verified by measuring pixel heights here — jsdom always
  // reports 0 for offsetHeight/scrollHeight. Instead this asserts the
  // structural invariant the visual requirement depends on: every card in
  // the block carries the compact-spacing class, and the block itself
  // applies no scroll container of its own (no overflow-y-auto), so there
  // is nothing to scroll within it. True pixel-fit verification belongs in
  // the Playwright e2e suite (npm run test:e2e).
  it('applies compact spacing to every card and does not introduce its own scroll container', () => {
    vi.setSystemTime(Date.parse('2026-08-12T17:45:45Z'))

    render(<LiveScreen />)

    const block = screen.getByTestId('totality-block')
    expect(block.className).not.toMatch(/overflow-y-auto/)

    const cards = block.querySelectorAll('[data-testid="event-card"]')
    for (const card of cards) {
      expect(card.className).toMatch(/py-0\.5/)
    }
  })
})

describe('LiveScreen auto-scroll wiring', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    navigator.wakeLock = { request: vi.fn().mockResolvedValue({ release: vi.fn() }) }
    Element.prototype.scrollIntoView = vi.fn()
  })

  afterEach(() => {
    vi.useRealTimers()
    delete navigator.wakeLock
    vi.restoreAllMocks()
  })

  it('scrolls the active card into view instantly on mount', () => {
    vi.setSystemTime(Date.parse('2026-08-12T16:46:00Z'))

    render(<LiveScreen />)

    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'auto',
      block: 'center',
    })
  })

  it('suspends auto-scroll and shows the "↓ NOW" pill on manual scroll, then resumes on tap', () => {
    vi.setSystemTime(Date.parse('2026-08-12T16:46:00Z'))

    render(<LiveScreen />)
    expect(screen.queryByText('↓ NOW')).not.toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(600)
    })
    fireEvent.scroll(screen.getByTestId('event-list'))

    expect(screen.getByText('↓ NOW')).toBeInTheDocument()

    fireEvent.click(screen.getByText('↓ NOW'))

    expect(screen.queryByText('↓ NOW')).not.toBeInTheDocument()
  })

  it('resumes automatically 12 seconds after a manual scroll with no further touch', () => {
    vi.setSystemTime(Date.parse('2026-08-12T16:46:00Z'))

    render(<LiveScreen />)
    act(() => {
      vi.advanceTimersByTime(600)
    })
    fireEvent.scroll(screen.getByTestId('event-list'))
    expect(screen.getByText('↓ NOW')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(12000)
    })

    expect(screen.queryByText('↓ NOW')).not.toBeInTheDocument()
  })

  it('still scrolls the active card into view when it is inside the totality compact block, not the regular list', () => {
    // burst-2 (17:46:38Z, active until earth-2 at 17:46:48Z) IS one of the totality-block ids —
    // the block renders it, not the regular scrolling list, so the ref that
    // drives auto-scroll must be wired there instead.
    vi.setSystemTime(Date.parse('2026-08-12T17:46:40Z'))

    render(<LiveScreen />)

    expect(screen.getByTestId('totality-block')).toBeInTheDocument()
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'auto',
      block: 'center',
    })
  })
})

/** Mocks `window.matchMedia('(prefers-reduced-motion: reduce)')`. */
function mockPrefersReducedMotion(matches) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

describe('LiveScreen prefers-reduced-motion', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    navigator.wakeLock = { request: vi.fn().mockResolvedValue({ release: vi.fn() }) }
    Element.prototype.scrollIntoView = vi.fn()
  })

  afterEach(() => {
    vi.useRealTimers()
    delete navigator.wakeLock
    delete window.matchMedia
    vi.restoreAllMocks()
  })

  it('disables the active-card pulse animation when reduced motion is requested', () => {
    mockPrefersReducedMotion(true)
    // "arm" (critical, 16:45:00Z) is active at 16:46:00Z.
    vi.setSystemTime(Date.parse('2026-08-12T16:46:00Z'))

    render(<LiveScreen />)

    const activeCard = screen
      .getAllByTestId('event-card')
      .find((card) => card.dataset.state === 'active')
    expect(activeCard.className).not.toMatch(/animate-pulse/)
  })

  it('keeps the active-card pulse animation when reduced motion is not requested', () => {
    mockPrefersReducedMotion(false)
    vi.setSystemTime(Date.parse('2026-08-12T16:46:00Z'))

    render(<LiveScreen />)

    const activeCard = screen
      .getAllByTestId('event-card')
      .find((card) => card.dataset.state === 'active')
    expect(activeCard.className).toMatch(/animate-pulse/)
  })

  it('keeps scrolling instant (auto) instead of smooth for later retargets when reduced motion is requested', () => {
    mockPrefersReducedMotion(true)
    vi.setSystemTime(Date.parse('2026-08-12T16:46:00Z'))

    render(<LiveScreen />)
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'auto',
      block: 'center',
    })

    // Cross the c1 (16:47:00Z) boundary so the active card changes, forcing
    // a second retarget more than a second after the first.
    act(() => {
      vi.setSystemTime(Date.parse('2026-08-12T16:47:01Z'))
      vi.advanceTimersByTime(1250)
    })

    expect(Element.prototype.scrollIntoView).toHaveBeenLastCalledWith({
      behavior: 'auto',
      block: 'center',
    })
  })
})

describe('LiveScreen rehearsal banner (spec §8)', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    navigator.wakeLock = { request: vi.fn().mockResolvedValue({ release: vi.fn() }) }
  })

  afterEach(() => {
    vi.useRealTimers()
    delete navigator.wakeLock
    clockService.clearVirtual()
    vi.restoreAllMocks()
  })

  it('shows no banner while live, and the striped banner once rehearsal is armed', () => {
    vi.setSystemTime(Date.parse('2026-08-12T16:46:00Z'))

    render(<LiveScreen />)
    expect(screen.queryByText('REHEARSAL — NOT LIVE')).not.toBeInTheDocument()

    act(() => {
      clockService.setVirtual(clockService.now(), 1)
      vi.advanceTimersByTime(250)
    })

    expect(screen.getByText('REHEARSAL — NOT LIVE')).toBeInTheDocument()
  })
})

describe('LiveScreen full rehearsal run at C2 -30s (spec §8, plan Slice 10 Step 10.5)', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    navigator.wakeLock = { request: vi.fn().mockResolvedValue({ release: vi.fn() }) }
    Element.prototype.scrollIntoView = vi.fn()
    speak.mockClear()
    playTone.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
    delete navigator.wakeLock
    clockService.clearVirtual()
    vi.restoreAllMocks()
  })

  // Shared creation method for every test in this describe (each test
  // verifies ONE behavior of the same rehearsal run, split from a former
  // all-in-one Eager Test so failures localize): arm the virtual clock at
  // C2-30s, mount, and advance to C2-11s — one tick before c2's own T-10
  // lead/warning instant — so each test observes the T-10 step itself
  // rather than it having already fired.
  function startRehearsalRunAtT11() {
    clockService.setVirtual(Date.parse(C2) - 30_000, 1)
    render(<LiveScreen />)
    act(() => {
      vi.advanceTimersByTime(19_000)
    })
  }

  function countWarningBlips() {
    return playTone.mock.calls.filter(([cue]) => cue === 'critical-warning').length
  }

  it('fires exactly one new warning blip per second T-10 through T-1, two once burst-1 overlaps, then the filter-off sweep at C2', () => {
    startRehearsalRunAtT11()

    // An EXACT per-step delta, not just "greater than before": burst-1
    // (6s after c2) starts its own T-10..T-1 warning window at c2's own
    // T-4, so from that point each tick legitimately carries two blips
    // (c2's own plus burst-1's), and a c2-specific regression hiding
    // behind burst-1's contribution would slip past a looser ">0" check.
    const EXPECTED_WARNING_DELTAS = [1, 1, 1, 1, 1, 1, 2, 2, 2, 2]

    let previousCount = countWarningBlips()
    for (const expectedDelta of EXPECTED_WARNING_DELTAS) {
      act(() => {
        vi.advanceTimersByTime(1000)
      })
      const count = countWarningBlips()
      expect(count - previousCount).toBe(expectedDelta)
      previousCount = count
    }

    // One more tick reaches c2's own due instant (now=C2): the sweep plays
    // instead of the standard critical-due cue, while burst-1's own T-6
    // warning (unrelated to c2) still legitimately fires alongside it.
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(countWarningBlips() - previousCount).toBe(1)
    expect(playTone).toHaveBeenCalledWith('filter-toggle')
    expect(playTone).not.toHaveBeenCalledWith('critical-due')
  })

  it("speaks c2's lead line at T-10", () => {
    startRehearsalRunAtT11()

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    // The T-10 step is exactly c2's default 10s critical lead instant.
    expect(speak).toHaveBeenCalledWith('Filter off. Filter off. Shoot the diamond ring.')
  })

  it('speaks all three earthshine calls distinctly across totality, and never a zoom prompt (fixed-focal change request §7)', () => {
    startRehearsalRunAtT11()

    const totalitySpanMs = Date.parse(C3) - Date.parse(C2) + 12_000
    for (let elapsed = 0; elapsed < totalitySpanMs; elapsed += 1000) {
      act(() => {
        vi.advanceTimersByTime(1000)
      })
    }

    expect(speak).toHaveBeenCalledWith('C two. Earthshine sets. Two presses.')
    expect(speak).toHaveBeenCalledWith('C two. Earthshine sets two. Three presses.')
    expect(speak).toHaveBeenCalledWith('C two. Last earthshine sets. Three presses.')
    for (const [spoken] of speak.mock.calls) {
      expect(spoken).not.toMatch(/[Zz]oom/)
    }
  })

  it('auto-scrolls unattended through all nine totality transitions, never showing the resume pill', () => {
    startRehearsalRunAtT11()

    // Reach c2's due instant (11s from T-11), then snapshot the scroll
    // count so the span loop below measures totality retargets only.
    act(() => {
      vi.advanceTimersByTime(11_000)
    })
    const scrollCallsAtC2 = Element.prototype.scrollIntoView.mock.calls.length

    // One-second steps (rather than one large jump) are deliberate: React
    // automatic batching coalesces every state update inside one act()
    // callback into a single render, so a single multi-minute jump would
    // only ever observe the FINAL active card, silently skipping every
    // intermediate totality step's own retarget.
    const totalitySpanMs = Date.parse(C3) - Date.parse(C2) + 1000
    for (let elapsed = 0; elapsed < totalitySpanMs; elapsed += 1000) {
      act(() => {
        vi.advanceTimersByTime(1000)
      })
    }

    // 9 transitions from c2 through to c3 (10 totality-block cards total),
    // each gap between anchors well over the 1s retarget throttle, so each
    // must produce its own retarget — an exact count, not a loose floor.
    expect(Element.prototype.scrollIntoView.mock.calls.length).toBe(scrollCallsAtC2 + 9)
    expect(screen.queryByText('↓ NOW')).not.toBeInTheDocument()
  })
})

describe('LiveScreen announcement catch-up (spec §7.4)', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    navigator.wakeLock = { request: vi.fn().mockResolvedValue({ release: vi.fn() }) }
    speak.mockClear()
    playTone.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
    delete navigator.wakeLock
    vi.restoreAllMocks()
  })

  it('never announces already-past events when opened mid-sequence, but keeps announcing future ones', () => {
    // arm (16:45:00Z), c1 (16:47:00Z), and check-1's own due instant
    // (17:00:00Z, exactly mount time) are all already due-or-past at mount.
    vi.setSystemTime(Date.parse('2026-08-12T17:00:00Z'))

    render(<LiveScreen />)

    expect(speak).not.toHaveBeenCalled()
    expect(playTone).not.toHaveBeenCalled()

    // check-2 (17:25:00Z, non-critical) was still in the future at mount —
    // the mechanism must still fire it once the tick naturally reaches it.
    act(() => {
      vi.setSystemTime(Date.parse('2026-08-12T17:25:00Z'))
      vi.advanceTimersByTime(250)
    })

    expect(playTone).toHaveBeenCalledWith('non-critical-due')
  })
})

describe('LiveScreen back-to-setup button', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    navigator.wakeLock = { request: vi.fn().mockResolvedValue({ release: vi.fn() }) }
  })

  afterEach(() => {
    vi.useRealTimers()
    delete navigator.wakeLock
    vi.restoreAllMocks()
  })

  it('renders no back button when onBack is not provided (e.g. every other test in this file)', () => {
    render(<LiveScreen />)

    expect(screen.queryByRole('button', { name: '← Setup' })).not.toBeInTheDocument()
  })

  it('calls onBack when the "← Setup" button is tapped', () => {
    const onBack = vi.fn()
    render(<LiveScreen onBack={onBack} />)

    fireEvent.click(screen.getByRole('button', { name: '← Setup' }))

    expect(onBack).toHaveBeenCalledTimes(1)
  })
})

describe('LiveScreen event list — completed steps removed', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    navigator.wakeLock = { request: vi.fn().mockResolvedValue({ release: vi.fn() }) }
  })

  afterEach(() => {
    vi.useRealTimers()
    delete navigator.wakeLock
    vi.restoreAllMocks()
  })

  it('drops completed steps from the list so the active step renders first', () => {
    // check-1 (17:00:00Z) is active: setup through c1 are all in the past
    // and must no longer occupy the top of the list.
    vi.setSystemTime(Date.parse('2026-08-12T17:00:30Z'))

    render(<LiveScreen />)
    const list = within(screen.getByTestId('event-list'))

    expect(list.queryByText('Set up and polar align')).not.toBeInTheDocument()
    expect(list.queryByText('First contact — start the timer')).not.toBeInTheDocument()

    const firstCard = screen.getByTestId('event-list').firstElementChild
    expect(firstCard).toHaveTextContent('Quiet check')
    expect(firstCard).toHaveTextContent('17:00:00')
  })

  it('keeps past totality cards visible in the block (spec §6.3) while past non-block steps leave the list', () => {
    // Mid-totality (earth-2 active): the block must still show the WHOLE
    // sequence, c2 included, even though c2 is past — while already-passed
    // pre-totality steps are gone from the scrolling list.
    vi.setSystemTime(Date.parse('2026-08-12T17:46:50Z'))

    render(<LiveScreen />)

    const block = within(screen.getByTestId('totality-block'))
    expect(block.getByText('FILTER OFF — diamond ring')).toBeInTheDocument()
    expect(block.getByText('Prominence sets 1')).toBeInTheDocument()

    const list = within(screen.getByTestId('event-list'))
    expect(list.queryByText('Final check — hand on the filter')).not.toBeInTheDocument()
    expect(list.queryByText('Arm the timer')).not.toBeInTheDocument()
  })

  it('leaves only the final step once the timeline is done', () => {
    vi.setSystemTime(Date.parse('2026-08-12T19:00:00Z'))

    render(<LiveScreen />)
    const list = screen.getByTestId('event-list')

    expect(list.children).toHaveLength(1)
    expect(list.firstElementChild).toHaveTextContent('Fourth contact — done')
  })
})
