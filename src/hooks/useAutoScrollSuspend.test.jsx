import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAutoScrollSuspend } from './useAutoScrollSuspend.js'

/**
 * Minimal real-DOM harness: a scroll container with one "active card" node,
 * wired exactly the way LiveScreen will wire it — containerRef on the
 * scrollable div, setActiveCardRef on the current active card.
 */
function TestHarness({ activeKey, prefersReducedMotion }) {
  const { containerRef, setActiveCardRef, showResumePill, resume } = useAutoScrollSuspend({
    activeKey,
    prefersReducedMotion,
  })

  return (
    <div>
      <div data-testid="container" ref={containerRef}>
        <div data-testid="card" ref={setActiveCardRef}>
          {activeKey}
        </div>
      </div>
      {showResumePill && (
        <button type="button" onClick={resume}>
          ↓ NOW
        </button>
      )}
    </div>
  )
}

describe('useAutoScrollSuspend', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    Element.prototype.scrollIntoView = vi.fn()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('scrolls the active card instantly (behavior: auto) on the very first scroll', () => {
    render(<TestHarness activeKey="c1" />)

    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1)
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'auto',
      block: 'center',
    })
  })

  it('uses smooth scrolling for a retarget more than a second after the last one', () => {
    const { rerender } = render(<TestHarness activeKey="c1" />)

    vi.advanceTimersByTime(1000)
    rerender(<TestHarness activeKey="c2" />)

    expect(Element.prototype.scrollIntoView).toHaveBeenLastCalledWith({
      behavior: 'smooth',
      block: 'center',
    })
  })

  it('retargets at most once per second', () => {
    const { rerender } = render(<TestHarness activeKey="c1" />)
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1)

    // A retarget 400ms after the first must not fire immediately.
    vi.advanceTimersByTime(400)
    rerender(<TestHarness activeKey="c2" />)
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1)

    // Once the remaining 600ms elapses, the throttled retarget fires.
    vi.advanceTimersByTime(600)
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(2)
  })

  // Manual-scroll tests advance the clock past the hook's own
  // programmatic-scroll suppression window (500ms — see
  // PROGRAMMATIC_SCROLL_WINDOW_MS in useAutoScrollSuspend.js) before firing
  // a synthetic 'scroll' event, matching a genuine user scroll that happens
  // sometime after the mount's own auto-scroll landed, not the same instant.

  it('suspends auto-scroll and shows the "↓ NOW" pill on manual scroll', () => {
    render(<TestHarness activeKey="c1" />)
    expect(screen.queryByText('↓ NOW')).not.toBeInTheDocument()

    vi.advanceTimersByTime(600)
    fireEvent.scroll(screen.getByTestId('container'))

    expect(screen.getByText('↓ NOW')).toBeInTheDocument()
  })

  it('treats a scroll within the programmatic-scroll window as an echo, not a manual scroll', () => {
    render(<TestHarness activeKey="c1" />)

    // Fires well inside the 500ms echo window right after mount's own
    // scrollIntoView call — must be swallowed, not treated as manual.
    vi.advanceTimersByTime(200)
    fireEvent.scroll(screen.getByTestId('container'))

    expect(screen.queryByText('↓ NOW')).not.toBeInTheDocument()
  })

  it('extends the echo window on each echoed scroll event, so a smooth scroll that keeps emitting past 500ms is still not mistaken for manual', () => {
    render(<TestHarness activeKey="c1" />)

    // Two more echo events, each refreshing the window before it expires —
    // without the refresh, the second of these (at 700ms since the original
    // call) would fall outside a fixed 500ms window and wrongly suspend.
    vi.advanceTimersByTime(400)
    fireEvent.scroll(screen.getByTestId('container'))
    vi.advanceTimersByTime(300)
    fireEvent.scroll(screen.getByTestId('container'))

    expect(screen.queryByText('↓ NOW')).not.toBeInTheDocument()
  })

  it('eventually treats a continuous real drag as manual, even though each individual gap is inside the echo window', () => {
    render(<TestHarness activeKey="c1" />)

    // A real manual drag firing scroll events every 400ms (each one inside
    // the 500ms echo window on its own) must still register as manual once
    // the total run exceeds the 1500ms ceiling from the original call —
    // otherwise a drag that happens to start right after a retarget could
    // refresh the echo window forever and never suspend.
    vi.advanceTimersByTime(400)
    fireEvent.scroll(screen.getByTestId('container'))
    vi.advanceTimersByTime(400)
    fireEvent.scroll(screen.getByTestId('container'))
    vi.advanceTimersByTime(400)
    fireEvent.scroll(screen.getByTestId('container'))
    vi.advanceTimersByTime(400)
    fireEvent.scroll(screen.getByTestId('container'))

    expect(screen.getByText('↓ NOW')).toBeInTheDocument()
  })

  it('does not retarget while suspended', () => {
    const { rerender } = render(<TestHarness activeKey="c1" />)
    vi.advanceTimersByTime(600)
    fireEvent.scroll(screen.getByTestId('container'))
    Element.prototype.scrollIntoView.mockClear()

    vi.advanceTimersByTime(1000)
    rerender(<TestHarness activeKey="c2" />)

    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled()
  })

  it('resumes auto-scroll when the "↓ NOW" pill is tapped', () => {
    const { rerender } = render(<TestHarness activeKey="c1" />)
    vi.advanceTimersByTime(600)
    fireEvent.scroll(screen.getByTestId('container'))
    Element.prototype.scrollIntoView.mockClear()

    fireEvent.click(screen.getByText('↓ NOW'))
    expect(screen.queryByText('↓ NOW')).not.toBeInTheDocument()

    vi.advanceTimersByTime(1000)
    rerender(<TestHarness activeKey="c2" />)

    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1)
  })

  it('resumes automatically after 12 seconds of no manual scroll', () => {
    render(<TestHarness activeKey="c1" />)
    vi.advanceTimersByTime(600)
    fireEvent.scroll(screen.getByTestId('container'))
    expect(screen.getByText('↓ NOW')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(11999)
    })
    expect(screen.getByText('↓ NOW')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(screen.queryByText('↓ NOW')).not.toBeInTheDocument()
  })
})
