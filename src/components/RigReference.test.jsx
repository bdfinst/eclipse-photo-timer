import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import RigReference from './RigReference.jsx'
import { POWER, ZOOM_MARKS } from '../data/rigReference.js'

// Key values asserted as literals, deliberately NOT imported from the data
// module — a circular oracle couldn't catch a transcription typo slipping
// into the data. Source: the operator's field card, page 2.
describe('RigReference', () => {
  it('renders the single locked zoom mark — native 600mm, no teleconverter', () => {
    render(<RigReference />)

    expect(ZOOM_MARKS.marks.map((mark) => mark.barrel)).toEqual(['600'])
    expect(screen.getByText('600 — LOCKED all day — never changes')).toBeInTheDocument()
    expect(screen.getByText('600mm true · 1200mm FF · 2.3 × 3.1 Rs in frame')).toBeInTheDocument()
    expect(screen.queryByText(/250 —/)).not.toBeInTheDocument()
    expect(screen.getByText(/Zoom to the 600 stop and tape it/)).toBeInTheDocument()
  })

  it('renders the timer program headline', () => {
    render(<RigReference />)

    expect(screen.getByText('DELAY 0 · LONG 1″ · INTVL 7″ · N = 472')).toBeInTheDocument()
    expect(screen.getByText(/N = 472 makes it stop itself 4 min before C2/)).toBeInTheDocument()
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
