import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SettingsPanel, {
  AUDIO_MASTER_KEY,
  AUDIO_TONES_KEY,
  AUDIO_VOICE_KEY,
  CLOCK_OFFSET_KEY,
  KEEP_AWAKE_KEY,
} from './SettingsPanel.jsx'

describe('SettingsPanel clock offset stepper', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('adjusts and persists the offset when the operator taps +10s twice', () => {
    render(<SettingsPanel />)

    const plusTenButton = screen.getByRole('button', { name: '+10s' })
    fireEvent.click(plusTenButton)
    fireEvent.click(plusTenButton)

    expect(screen.getByText('+20s')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(CLOCK_OFFSET_KEY))).toBe(20000)
  })
})

describe('SettingsPanel device time display', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-12T16:30:05Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the raw device clock to the second, ticking independently of the offset', () => {
    render(<SettingsPanel />)

    expect(screen.getByText('16:30:05')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(screen.getByText('16:30:06')).toBeInTheDocument()
  })
})

describe('SettingsPanel audio and keep-awake toggles', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it.each([
    ['Audio master', AUDIO_MASTER_KEY],
    ['Voice', AUDIO_VOICE_KEY],
    ['Tones', AUDIO_TONES_KEY],
    ['Keep screen awake', KEEP_AWAKE_KEY],
  ])('toggling "%s" flips and persists its stored value', (label, key) => {
    render(<SettingsPanel />)

    const toggle = screen.getByLabelText(label)
    expect(toggle).toBeChecked()

    fireEvent.click(toggle)

    expect(toggle).not.toBeChecked()
    expect(JSON.parse(localStorage.getItem(key))).toBe(false)
  })

  it('defaults keep screen awake to on when nothing is persisted', () => {
    render(<SettingsPanel />)

    expect(screen.getByLabelText('Keep screen awake')).toBeChecked()
  })
})

function createMockAudioContext() {
  const instances = []

  function AudioContextMock() {
    this.currentTime = 0
    this.destination = {}
    instances.push(this)
  }

  AudioContextMock.prototype.createOscillator = function () {
    return {
      type: null,
      frequency: { value: 0 },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    }
  }

  AudioContextMock.prototype.createGain = function () {
    return { gain: { value: 0 }, connect: vi.fn() }
  }

  return { AudioContextMock, instances }
}

describe('SettingsPanel test audio button', () => {
  let synth
  let instances

  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()

    synth = {
      cancel: vi.fn(),
      speak: vi.fn(),
      getVoices: vi.fn(() => []),
    }
    window.speechSynthesis = synth
    global.SpeechSynthesisUtterance = vi.fn(function (text) {
      this.text = text
    })

    const mock = createMockAudioContext()
    instances = mock.instances
    window.AudioContext = mock.AudioContextMock
  })

  afterEach(() => {
    delete window.speechSynthesis
    delete global.SpeechSynthesisUtterance
    delete window.AudioContext
    vi.useRealTimers()
  })

  it('calls the real speak and playTone functions for each of the four cues, mocked only at the browser API boundary', () => {
    render(<SettingsPanel />)

    fireEvent.click(screen.getByRole('button', { name: 'Test audio' }))

    expect(synth.speak).toHaveBeenCalledTimes(1)
    expect(synth.speak.mock.calls[0][0].text).toBe('Audio ready')

    // One playTone(cue) call per defined cue schedule — non-critical-due,
    // critical-warning, critical-due, filter-toggle — each construct their
    // own AudioContext (audio.js's playTone implementation).
    expect(instances).toHaveLength(0)

    act(() => {
      vi.advanceTimersByTime(2100)
    })

    expect(instances).toHaveLength(4)
  })

  it('plays the four cues one at a time, never overlapping', () => {
    render(<SettingsPanel />)

    fireEvent.click(screen.getByRole('button', { name: 'Test audio' }))

    // Each cue starts 700ms after the previous — advancing by less than
    // that must never let a second cue's AudioContext appear early.
    act(() => {
      vi.advanceTimersByTime(699)
    })
    expect(instances).toHaveLength(1)

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(instances).toHaveLength(2)

    act(() => {
      vi.advanceTimersByTime(1400)
    })
    expect(instances).toHaveLength(4)
  })
})
