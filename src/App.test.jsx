import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import App, { HOME_SCREEN_BANNER_SEEN_KEY } from './App'
import { setItem } from './services/storage.js'

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

describe('iOS install metadata (index.html)', () => {
  it('declares an apple-touch-icon link', () => {
    expect(indexHtml).toMatch(/<link\s[^>]*rel="apple-touch-icon"/)
  })

  it('declares apple-mobile-web-app-capable', () => {
    expect(indexHtml).toMatch(/<meta\s[^>]*name="apple-mobile-web-app-capable"[^>]*content="yes"/)
  })
})
