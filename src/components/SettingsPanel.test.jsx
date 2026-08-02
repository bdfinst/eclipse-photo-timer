import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetSharedAudioContextForTests } from '../services/audio.js'
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
  const oscillators = []

  function AudioContextMock() {
    this.currentTime = 0
    this.destination = {}
    instances.push(this)
  }

  AudioContextMock.prototype.createOscillator = function () {
    const oscillator = {
      type: null,
      frequency: { value: 0 },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    }
    oscillators.push(oscillator)
    return oscillator
  }

  AudioContextMock.prototype.createGain = function () {
    return { gain: { value: 0 }, connect: vi.fn() }
  }

  // primeAudio()'s silent unlock buffer (audio.js) goes through these.
  AudioContextMock.prototype.createBuffer = function () {
    return {}
  }

  AudioContextMock.prototype.createBufferSource = function () {
    return { buffer: null, connect: vi.fn(), start: vi.fn() }
  }

  return { AudioContextMock, instances, oscillators }
}

describe('SettingsPanel speaking-voice picker', () => {
  let synth
  let voicesChangedListeners

  beforeEach(() => {
    localStorage.clear()
    voicesChangedListeners = []
    synth = {
      cancel: vi.fn(),
      speak: vi.fn(),
      getVoices: vi.fn(() => [
        { name: 'Martha', lang: 'en-GB' },
        { name: 'Samantha', lang: 'en-US' },
      ]),
      addEventListener: vi.fn((eventName, listener) => {
        if (eventName === 'voiceschanged') voicesChangedListeners.push(listener)
      }),
      removeEventListener: vi.fn(),
    }
    window.speechSynthesis = synth
    global.SpeechSynthesisUtterance = vi.fn(function (text) {
      this.text = text
    })
  })

  afterEach(() => {
    delete window.speechSynthesis
    delete global.SpeechSynthesisUtterance
  })

  it('lists Auto plus every installed English voice, labelled by accent', () => {
    render(<SettingsPanel />)

    const select = screen.getByLabelText('Speaking voice')
    const labels = Array.from(select.options).map((option) => option.textContent)

    expect(labels).toEqual([
      'Auto — female voice, UK English preferred',
      'Martha (UK)',
      'Samantha (US)',
    ])
  })

  it('persists the chosen voice and speaks a preview with it', () => {
    render(<SettingsPanel />)

    fireEvent.change(screen.getByLabelText('Speaking voice'), {
      target: { value: 'Samantha' },
    })

    expect(JSON.parse(localStorage.getItem('eclipse.voiceName'))).toBe('Samantha')
    expect(synth.speak).toHaveBeenCalledTimes(1)
    // The preview must audition the voice that was just chosen, not the
    // auto preference (which would pick Martha here).
    expect(synth.speak.mock.calls[0][0].voice).toEqual({ name: 'Samantha', lang: 'en-US' })
  })

  it('shows Auto when the stored voice is not installed on this device, matching the spoken fallback', () => {
    localStorage.setItem('eclipse.voiceName', JSON.stringify('Daniel'))

    render(<SettingsPanel />)

    expect(screen.getByLabelText('Speaking voice').value).toBe('auto')
  })

  it('does not speak a preview when the Voice toggle is off — same contract as Test audio', () => {
    render(<SettingsPanel />)
    fireEvent.click(screen.getByLabelText('Voice'))
    synth.speak.mockClear()

    fireEvent.change(screen.getByLabelText('Speaking voice'), {
      target: { value: 'Samantha' },
    })

    // The choice still persists — only the audition is suppressed.
    expect(JSON.parse(localStorage.getItem('eclipse.voiceName'))).toBe('Samantha')
    expect(synth.speak).not.toHaveBeenCalled()
  })

  it('refreshes the options when the browser fires voiceschanged with a fuller list', () => {
    render(<SettingsPanel />)
    expect(screen.getByLabelText('Speaking voice').options).toHaveLength(3)

    synth.getVoices.mockReturnValue([
      { name: 'Martha', lang: 'en-GB' },
      { name: 'Samantha', lang: 'en-US' },
      { name: 'Daniel', lang: 'en-GB' },
    ])
    act(() => {
      voicesChangedListeners.forEach((listener) => listener())
    })

    expect(screen.getByLabelText('Speaking voice').options).toHaveLength(4)
  })
})

describe('SettingsPanel test audio button', () => {
  let synth
  let instances
  let oscillators

  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    // audio.js caches one shared AudioContext at module level — drop it so
    // each test's freshly-installed mock class is the one constructed.
    resetSharedAudioContextForTests()

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
    oscillators = mock.oscillators
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

    // The tap itself only primes the shared AudioContext (audio.js) — one
    // context total, never one per cue — and no tone has sounded yet.
    expect(instances).toHaveLength(1)
    expect(oscillators).toHaveLength(0)

    act(() => {
      vi.advanceTimersByTime(2100)
    })

    // All four cue schedules ran on that same shared context:
    // non-critical-due (1 osc) + critical-warning (1) + critical-due (3) +
    // filter-toggle (2).
    expect(instances).toHaveLength(1)
    expect(oscillators).toHaveLength(7)
  })

  it('plays the four cues one at a time, never overlapping', () => {
    render(<SettingsPanel />)

    fireEvent.click(screen.getByRole('button', { name: 'Test audio' }))

    // Each cue starts 700ms after the previous — advancing by less than
    // that must never let a second cue's oscillators appear early.
    act(() => {
      vi.advanceTimersByTime(699)
    })
    expect(oscillators).toHaveLength(1)

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(oscillators).toHaveLength(2)

    act(() => {
      vi.advanceTimersByTime(1400)
    })
    expect(oscillators).toHaveLength(7)
  })

  it('primes the audio context during the tap so setTimeout-scheduled cues are not silenced by autoplay policy', () => {
    render(<SettingsPanel />)

    fireEvent.click(screen.getByRole('button', { name: 'Test audio' }))

    // The context must exist BEFORE any timer fires — created inside the
    // click gesture, which is what makes it resumable at all.
    expect(instances).toHaveLength(1)
  })

  it('skips the voice line but still plays tones when Voice is off', () => {
    render(<SettingsPanel />)
    fireEvent.click(screen.getByLabelText('Voice'))

    fireEvent.click(screen.getByRole('button', { name: 'Test audio' }))
    act(() => {
      vi.advanceTimersByTime(2100)
    })

    expect(synth.speak).not.toHaveBeenCalled()
    expect(oscillators).toHaveLength(7)
  })

  it('skips the tones but still speaks when Tones is off', () => {
    render(<SettingsPanel />)
    fireEvent.click(screen.getByLabelText('Tones'))

    fireEvent.click(screen.getByRole('button', { name: 'Test audio' }))
    act(() => {
      vi.advanceTimersByTime(2100)
    })

    expect(synth.speak).toHaveBeenCalledTimes(1)
    expect(oscillators).toHaveLength(0)
  })

  it('plays nothing at all when Audio master is off — the test reflects exactly what the live screen would play', () => {
    render(<SettingsPanel />)
    fireEvent.click(screen.getByLabelText('Audio master'))

    fireEvent.click(screen.getByRole('button', { name: 'Test audio' }))
    act(() => {
      vi.advanceTimersByTime(2100)
    })

    expect(synth.speak).not.toHaveBeenCalled()
    expect(oscillators).toHaveLength(0)
  })
})
