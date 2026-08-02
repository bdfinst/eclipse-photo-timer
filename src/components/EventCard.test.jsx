import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import EventCard from './EventCard.jsx'

// Fixture events cover each phase/critical combination the Scenario Outline
// and the critical-styling scenario need. Times are arbitrary — EventCard's
// relative label is computed against C2 (2026-08-12T17:46:10Z), not "now".
const baseEvent = {
  id: 'check-1',
  at: '2026-08-12T17:00:00Z',
  phase: 'partial-1',
  mode: null,
  critical: false,
  filterOn: true,
  title: 'Quiet check',
  detail: 'Frame count advancing, sun still centred.',
}

function renderCard(overrides, state) {
  return render(<EventCard event={{ ...baseEvent, ...overrides }} state={state} />)
}

describe('EventCard state styling (Scenario Outline)', () => {
  it('past: 40% opacity, title only, detail collapsed, compact height', () => {
    renderCard({}, 'past')

    const card = screen.getByTestId('event-card')
    expect(card.className).toMatch(/opacity-40/)
    expect(screen.getByText('Quiet check')).toBeInTheDocument()
    expect(screen.queryByText(baseEvent.detail)).not.toBeInTheDocument()
  })

  it('active: accent border, largest type, detail always shown, subtle pulse', () => {
    renderCard({}, 'active')

    const card = screen.getByTestId('event-card')
    expect(card.className).toMatch(/ring-2 ring-sky-400/)
    expect(card.className).toMatch(/animate-pulse/)
    expect(screen.getByText(baseEvent.detail)).toBeInTheDocument()
  })

  it('next-up (within 60s): full opacity, slightly raised, detail shown', () => {
    renderCard({}, 'next-up')

    const card = screen.getByTestId('event-card')
    expect(card.className).toMatch(/opacity-100/)
    expect(card.className).toMatch(/shadow-md/)
    expect(card.className).toMatch(/-translate-y-0\.5/)
    expect(screen.getByText(baseEvent.detail)).toBeInTheDocument()
  })

  it('future: full opacity, normal type, detail shown', () => {
    renderCard({}, 'future')

    const card = screen.getByTestId('event-card')
    expect(card.className).toMatch(/opacity-100/)
    expect(screen.getByText(baseEvent.detail)).toBeInTheDocument()
  })

  it('future, > 30 min away: compact height, detail collapsed', () => {
    renderCard({}, 'future-far')

    expect(screen.getByText('Quiet check')).toBeInTheDocument()
    expect(screen.queryByText(baseEvent.detail)).not.toBeInTheDocument()
  })
})

describe('EventCard critical-event styling', () => {
  it('applies a heavier border, phase colour kept, and a warmer accent regardless of state (past)', () => {
    renderCard({ critical: true, phase: 'partial-1' }, 'past')

    const card = screen.getByTestId('event-card')
    expect(card.className).toMatch(/border-l-8/)
    // Phase colour is kept, not replaced (spec §6.4 peripheral readability).
    expect(card.className).toMatch(/border-l-blue-500/)
    expect(card.className).toMatch(/bg-amber-950\/20/)
  })

  it('applies heavier border and warmer accent regardless of state (future)', () => {
    renderCard({ critical: true }, 'future')

    const card = screen.getByTestId('event-card')
    expect(card.className).toMatch(/border-l-8/)
    expect(card.className).toMatch(/bg-amber-950\/20/)
  })

  it('non-critical events use a lighter phase-coloured border with no warm accent', () => {
    renderCard({ critical: false }, 'future')

    const card = screen.getByTestId('event-card')
    expect(card.className).not.toMatch(/border-l-8/)
    expect(card.className).not.toMatch(/bg-amber-950\/20/)
    expect(card.className).toMatch(/border-l-4/)
  })
})

describe('EventCard content', () => {
  it('renders time, relative label, and mode chip when present', () => {
    renderCard({ at: '2026-08-12T17:46:10Z', mode: 'C4' }, 'active')

    expect(screen.getByText('17:46:10')).toBeInTheDocument()
    // "DIAL" prefix disambiguates the custom-mode chip from the
    // eclipse contacts, which share the C1–C4 names.
    expect(screen.getByText('DIAL C4')).toBeInTheDocument()
    // At C2 itself the relative label is T+ 00:00:00.
    expect(screen.getByText('T+ 00:00:00')).toBeInTheDocument()
  })

  it('omits the mode chip when mode is null', () => {
    renderCard({ mode: null }, 'future')

    expect(screen.queryByText(/DIAL/)).not.toBeInTheDocument()
  })

  it('renders a T− label for an event before C2', () => {
    // c1 is 2026-08-12T16:47:00Z, exactly 59:10 before C2 (17:46:10Z).
    renderCard({ at: '2026-08-12T16:47:00Z' }, 'past')

    expect(screen.getByText('T− 00:59:10')).toBeInTheDocument()
  })

  it('renders a T+ label for an event after C2', () => {
    // burst-1 is 2026-08-12T17:46:16Z, exactly 6s after C2.
    renderCard({ at: '2026-08-12T17:46:16Z' }, 'active')

    expect(screen.getByText('T+ 00:00:06')).toBeInTheDocument()
  })
})

describe('EventCard prefers-reduced-motion', () => {
  it('applies the pulse animation on the active card by default', () => {
    render(<EventCard event={baseEvent} state="active" />)

    expect(screen.getByTestId('event-card').className).toMatch(/animate-pulse/)
  })

  it('disables the pulse animation on the active card when reduced motion is requested', () => {
    render(<EventCard event={baseEvent} state="active" prefersReducedMotion />)

    expect(screen.getByTestId('event-card').className).not.toMatch(/animate-pulse/)
  })
})
