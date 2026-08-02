import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import CameraSettingsReference from './CameraSettingsReference.jsx'
import { CUSTOM_MODES, GLOBAL_SETTINGS } from '../data/cameraSettings.js'

// Key values asserted as literals, deliberately NOT imported from the data
// module — a circular oracle couldn't catch a transcription typo slipping
// into the data. Sources: the operator's field card, page 1.
describe('CameraSettingsReference', () => {
  it('renders the rig summary line', () => {
    render(<CameraSettingsReference />)

    expect(
      screen.getByText(
        'OM-1 · 150-600 + MC-20 always on = 300–1200mm true, f/10–f/13 · SafeSight ND 5.0',
      ),
    ).toBeInTheDocument()
  })

  it('renders every global set-once setting', () => {
    render(<CameraSettingsReference />)

    expect(screen.getByText('White balance')).toBeInTheDocument()
    expect(screen.getByText('5400K fixed — never Auto')).toBeInTheDocument()
    expect(screen.getByText('Mode retention')).toBeInTheDocument()
    // All 14 rows present — one dt per setting.
    for (const setting of GLOBAL_SETTINGS) {
      expect(screen.getByText(setting.label)).toBeInTheDocument()
    }
  })

  it('renders all four custom modes with their headline settings', () => {
    render(<CameraSettingsReference />)

    expect(screen.getByText('Dial C1 — Partial phases')).toBeInTheDocument()
    expect(screen.getByText('ISO 200 · 1/400 · Single drive')).toBeInTheDocument()
    expect(screen.getByText('Dial C2 — Totality bracket')).toBeInTheDocument()
    expect(
      screen.getByText('ISO 200 · base 1/50 · Menu › Shooting 2 › HDR › 7f 2.0EV'),
    ).toBeInTheDocument()
    expect(screen.getByText('Dial C3 — Outer corona & earthshine')).toBeInTheDocument()
    expect(
      screen.getByText('ISO 1600 · base 1/6 · Menu › Shooting 2 › HDR › 5f 2.0EV'),
    ).toBeInTheDocument()
    expect(screen.getByText("Dial C4 — Diamond ring / Baily's beads")).toBeInTheDocument()
    expect(screen.getByText('ISO 200 · 1/2500 · ProCap SH2')).toBeInTheDocument()
  })

  // The C2/C3 shutter sets are disjoint, so every rendered value below is
  // unambiguous with getByText. The literal arrays double as both the data
  // oracle (toEqual) and the render oracle (every row asserted on screen —
  // a dropped middle row must fail, not just the endpoints).
  const C2_SHUTTERS = ['1/3200', '1/800', '1/200', '1/50', '1/13', '0.3"', '1.3"']
  const C3_SHUTTERS = ['1/100', '1/25', '1/6', '0.6"', '2.5"']

  it("renders C2's full seven-frame ladder from 1/3200 to 1.3 seconds", () => {
    render(<CameraSettingsReference />)

    const c2 = CUSTOM_MODES.find((mode) => mode.id === 'c2')
    expect(c2.ladder.map((step) => step.shutter)).toEqual(C2_SHUTTERS)
    for (const shutter of C2_SHUTTERS) {
      expect(screen.getByText(shutter)).toBeInTheDocument()
    }
    expect(screen.getByText('chromosphere')).toBeInTheDocument()
    expect(screen.getByText('0.2 Rs + diamond')).toBeInTheDocument()
  })

  it("renders C3's five-frame ladder ending at the earthshine stretch goal", () => {
    render(<CameraSettingsReference />)

    const c3 = CUSTOM_MODES.find((mode) => mode.id === 'c3')
    expect(c3.ladder.map((step) => step.shutter)).toEqual(C3_SHUTTERS)
    for (const shutter of C3_SHUTTERS) {
      expect(screen.getByText(shutter)).toBeInTheDocument()
    }
    expect(screen.getByText('earthshine')).toBeInTheDocument()
  })

  it('renders the filter rule warning', () => {
    render(<CameraSettingsReference />)

    expect(
      screen.getByText(
        'FILTER ON for every second outside totality. OFF only between 2nd and 3rd contact.',
      ),
    ).toBeInTheDocument()
  })
})
