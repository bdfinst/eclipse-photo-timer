import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App, { HOME_SCREEN_BANNER_SEEN_KEY } from './App'
import { setItem } from './services/storage.js'
import { unlockAudio } from './services/audio.js'
import { resetAnnouncementState } from './hooks/useAnnouncements.js'
import { resetRehearsalControlsState } from './hooks/useRehearsalControls.js'

vi.mock('./services/audio.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, unlockAudio: vi.fn(() => ({ ok: true })) }
})

// useAnnouncements' consumed/first-tick state and useRehearsalControls'
// paused/preSpeed state are both module-level (session-scoped — see each
// hook's own docstring), so they otherwise leak across this file's several
// LiveScreen/PrepScreen mounts (via GO LIVE / the "← Setup" button). Reset
// before each test.
beforeEach(() => {
  resetAnnouncementState()
  resetRehearsalControlsState()
})

// Independently authored from spec §9, deliberately NOT imported from
// ./App's HOME_SCREEN_BANNER_TEXT — asserting against the app's own exported
// constant would be a circular oracle that can't catch copy drift.
const HOME_SCREEN_BANNER_TEXT = 'Add to Home Screen and open it once offline before you travel.'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const indexHtml = readFileSync(path.join(__dirname, '..', 'index.html'), 'utf-8')

describe('App', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders the app title', () => {
    render(<App />)
    expect(screen.getByText('Eclipse Timer')).toBeInTheDocument()
  })

  it('shows the add-to-home-screen banner on first load', () => {
    render(<App />)
    expect(screen.getByText(HOME_SCREEN_BANNER_TEXT)).toBeInTheDocument()
  })

  it('does not show the banner once the seen flag is persisted', () => {
    setItem(HOME_SCREEN_BANNER_SEEN_KEY, true)
    render(<App />)
    expect(screen.queryByText(HOME_SCREEN_BANNER_TEXT)).not.toBeInTheDocument()
  })
})

describe('App GO LIVE flow', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    navigator.wakeLock = { request: vi.fn().mockResolvedValue({ release: vi.fn() }) }
    unlockAudio.mockClear()
    unlockAudio.mockReturnValue({ ok: true })
  })

  afterEach(() => {
    vi.useRealTimers()
    delete navigator.wakeLock
    vi.restoreAllMocks()
  })

  it('unlocks audio as part of the GO LIVE gesture and switches to the live screen', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'GO LIVE →' }))

    expect(unlockAudio).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('event-list')).toBeInTheDocument()
  })

  it('still switches to the live screen when the unlock attempt fails, and shows the failure warning', () => {
    unlockAudio.mockReturnValue({ ok: false, reason: 'unsupported' })
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'GO LIVE →' }))

    // The operator must never be stranded on the prep screen because audio
    // confirmation couldn't be verified.
    expect(screen.getByTestId('event-list')).toBeInTheDocument()
    expect(screen.getByText(/audio confirmation could not be verified/i)).toBeInTheDocument()
  })

  it('returns to the prep screen when "← Setup" is tapped on the live screen', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'GO LIVE →' }))
    expect(screen.getByTestId('event-list')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '← Setup' }))

    expect(screen.getByRole('button', { name: 'GO LIVE →' })).toBeInTheDocument()
    expect(screen.queryByTestId('event-list')).not.toBeInTheDocument()
  })
})

describe('iOS install metadata (index.html)', () => {
  it('declares an apple-touch-icon link', () => {
    expect(indexHtml).toMatch(/<link\s[^>]*rel="apple-touch-icon"/)
  })

  it('declares apple-mobile-web-app-capable', () => {
    expect(indexHtml).toMatch(/<meta\s[^>]*name="apple-mobile-web-app-capable"[^>]*content="yes"/)
  })
})
