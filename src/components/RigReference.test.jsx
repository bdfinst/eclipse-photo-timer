import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import RigReference from './RigReference.jsx'
import { POWER, ZOOM_MARKS } from '../data/rigReference.js'

// Key values asserted as literals, deliberately NOT imported from the data
// module — a circular oracle couldn't catch a transcription typo slipping
// into the data. Source: the operator's field card, page 2.
describe('RigReference', () => {
  it('renders both zoom marks with their optics and purpose', () => {
    render(<RigReference />)

    expect(ZOOM_MARKS.marks.map((mark) => mark.barrel)).toEqual(['250', '500'])
    expect(screen.getByText('250 — Corona — all day except the two ends')).toBeInTheDocument()
    expect(screen.getByText('500mm true · 1000mm FF · 2.8 × 3.8 Rs in frame')).toBeInTheDocument()
    expect(screen.getByText('500 — Prominences — 17:45:40–17:46:40 only')).toBeInTheDocument()
    expect(screen.getByText('1000mm true · 2000mm FF · 1.4 × 1.9 Rs in frame')).toBeInTheDocument()
  })

  it('renders the timer program headline', () => {
    render(<RigReference />)

    expect(screen.getByText('DELAY 0 · LONG 1″ · INTVL 4″ · N = 826')).toBeInTheDocument()
    expect(screen.getByText(/N = 826 makes it stop itself 4 min before C2/)).toBeInTheDocument()
  })

  it('renders the mount guidance', () => {
    render(<RigReference />)

    expect(screen.getByText('Star Adventurer GTi')).toBeInTheDocument()
    expect(screen.getByText(/Polar align before first contact/)).toBeInTheDocument()
    expect(screen.getByText(/8×AA lithium in the mount/)).toBeInTheDocument()
  })

  it('renders all four power rows including the do-not-touch rule', () => {
    render(<RigReference />)

    expect(POWER.rows.map((row) => row.label)).toEqual(['Camera', 'Mount', 'Then stop', 'Card'])
    expect(screen.getByText('Then stop')).toBeInTheDocument()
    expect(screen.getByText(/Once both are plugged in, do not touch any port/)).toBeInTheDocument()
    expect(screen.getByText(/Never feed it 15 V/)).toBeInTheDocument()
    expect(screen.getByText(/64 GB minimum, UHS-II, slot 1/)).toBeInTheDocument()
  })
})
