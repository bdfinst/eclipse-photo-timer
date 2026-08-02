import { act, render, screen } from '@testing-library/react'
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

    expect(screen.getByText('Arm the timer')).toBeInTheDocument()
    expect(screen.getByText('T− 00:42')).toBeInTheDocument()
  })

  it('switches to a large single number when the next event is 7 seconds away', () => {
    // "arm" is at 16:45:00Z — 7s before is 16:44:53Z.
    vi.setSystemTime(Date.parse('2026-08-12T16:44:53Z'))

    render(<LiveScreen />)

    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.queryByText(/T− /)).not.toBeInTheDocument()
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
