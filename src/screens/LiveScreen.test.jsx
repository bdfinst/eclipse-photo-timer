import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LiveScreen from './LiveScreen.jsx'
import { setItem } from '../services/storage.js'
import { clockService } from '../services/clock.js'

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

  it('reads "T− 00:42" when the next event is 42 seconds away', () => {
    // "arm" is at 16:45:00Z — 42s before is 16:44:18Z.
    vi.setSystemTime(Date.parse('2026-08-12T16:44:18Z'))

    render(<LiveScreen />)
    // "Arm the timer" also appears as its own card in the scrolling event
    // list below (Slice 8) — scope to the NextAction region for uniqueness.
    const nextAction = within(screen.getByTestId('next-action'))

    expect(nextAction.getByText('Arm the timer')).toBeInTheDocument()
    expect(nextAction.getByText('T− 00:42')).toBeInTheDocument()
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

// The 9 phase==='totality' events (spec §6.3) plus the c3 filter-on card,
// in EVENTS order.
const TOTALITY_BLOCK_IDS = [
  'c2',
  'burst-1',
  'burst-2',
  'zoom',
  'burst-3',
  'earthshine',
  'lookup',
  'burst-4',
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
    // burst-2 (17:46:25Z, active until zoom at 17:46:40Z) IS one of the totality-block ids —
    // the block renders it, not the regular scrolling list, so the ref that
    // drives auto-scroll must be wired there instead.
    vi.setSystemTime(Date.parse('2026-08-12T17:46:35Z'))

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
