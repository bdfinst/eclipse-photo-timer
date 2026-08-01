import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { playTone, shouldAnnounce, speak, unlockAudio } from './audio.js'

describe('audio: speak', () => {
  let synth

  beforeEach(() => {
    synth = {
      cancel: vi.fn(),
      speak: vi.fn(),
      getVoices: vi.fn(() => []),
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

  it('cancels any in-flight utterance before speaking the new one', () => {
    const callOrder = []
    synth.cancel.mockImplementation(() => callOrder.push('cancel'))
    synth.speak.mockImplementation(() => callOrder.push('speak'))

    speak('Filter off')

    expect(callOrder).toEqual(['cancel', 'speak'])
    expect(synth.speak).toHaveBeenCalledTimes(1)
  })

  it('returns { ok: false, reason: "unsupported" } when speechSynthesis is unavailable', () => {
    delete window.speechSynthesis

    const result = speak('Filter off')

    expect(result).toEqual({ ok: false, reason: 'unsupported' })
    expect(synth.speak).not.toHaveBeenCalled()
  })
})

function createMockAudioContext() {
  const oscillators = []

  function AudioContextMock() {
    this.currentTime = 0
    this.destination = {}
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

  return { AudioContextMock, oscillators }
}

describe('audio: playTone', () => {
  let oscillators

  beforeEach(() => {
    const mock = createMockAudioContext()
    oscillators = mock.oscillators
    window.AudioContext = mock.AudioContextMock
  })

  afterEach(() => {
    delete window.AudioContext
  })

  it.each([
    ['non-critical-due', 660, 120],
    ['critical-warning', 880, 80],
    ['critical-due', 1320, 100],
  ])('schedules %s at %dHz for %dms', (cue, frequency, duration) => {
    const result = playTone(cue)

    expect(result).toEqual({ ok: true })
    expect(oscillators[0].frequency.value).toBe(frequency)
    const [startedAt] = oscillators[0].start.mock.calls[0]
    const [stoppedAt] = oscillators[0].stop.mock.calls[0]
    expect((stoppedAt - startedAt) * 1000).toBeCloseTo(duration)
  })

  it('schedules critical-due as three 1320Hz blips 100ms apart', () => {
    playTone('critical-due')

    expect(oscillators).toHaveLength(3)
    oscillators.forEach((oscillator) => expect(oscillator.frequency.value).toBe(1320))
    const startTimes = oscillators.map((oscillator) => oscillator.start.mock.calls[0][0])
    expect(startTimes[1] - startTimes[0]).toBeCloseTo(0.1)
    expect(startTimes[2] - startTimes[1]).toBeCloseTo(0.1)
  })

  it('schedules filter-toggle as a distinct two-tone sweep totaling 600ms', () => {
    playTone('filter-toggle')

    expect(oscillators).toHaveLength(2)
    expect(oscillators[0].frequency.value).not.toBe(oscillators[1].frequency.value)
    const firstStart = oscillators[0].start.mock.calls[0][0]
    const lastStop = oscillators[1].stop.mock.calls[0][0]
    expect((lastStop - firstStart) * 1000).toBeCloseTo(600)
  })

  it('returns { ok: false, reason: "unsupported" } when AudioContext construction throws', () => {
    function ThrowingAudioContext() {
      throw new Error('blocked')
    }
    window.AudioContext = ThrowingAudioContext

    const result = playTone('non-critical-due')

    expect(result).toEqual({ ok: false, reason: 'unsupported' })
  })
})

describe('audio: shouldAnnounce', () => {
  it('returns false when the announcement instant is already in the past', () => {
    const now = 1_000_000
    const eventAt = now - 5000 // event happened 5 seconds ago

    expect(shouldAnnounce(eventAt, now, 0)).toBe(false)
  })

  it('returns false when the lead-adjusted instant has already passed, even though the event itself is still upcoming', () => {
    const now = 1_000_000
    const eventAt = now + 3000 // event is 3 seconds away
    const leadSeconds = 10 // announce instant would be 7 seconds in the past

    expect(shouldAnnounce(eventAt, now, leadSeconds)).toBe(false)
  })

  it('returns true when the announcement instant is still in the future', () => {
    const now = 1_000_000
    const eventAt = now + 15000 // event is 15 seconds away
    const leadSeconds = 10 // announce instant is 5 seconds from now

    expect(shouldAnnounce(eventAt, now, leadSeconds)).toBe(true)
  })
})

function createMockAudioContextForUnlock() {
  const bufferSource = {
    buffer: null,
    connect: vi.fn(),
    start: vi.fn(),
  }

  function AudioContextMock() {
    this.destination = {}
  }

  AudioContextMock.prototype.createBuffer = function () {
    return {}
  }

  AudioContextMock.prototype.createBufferSource = function () {
    return bufferSource
  }

  return { AudioContextMock, bufferSource }
}

describe('audio: unlockAudio', () => {
  let synth

  beforeEach(() => {
    synth = {
      cancel: vi.fn(),
      speak: vi.fn(),
      getVoices: vi.fn(() => []),
    }
    window.speechSynthesis = synth
    global.SpeechSynthesisUtterance = vi.fn(function (text) {
      this.text = text
    })
  })

  afterEach(() => {
    delete window.speechSynthesis
    delete global.SpeechSynthesisUtterance
    delete window.AudioContext
  })

  it('plays a silent buffer through the AudioContext and speaks a confirmation phrase', () => {
    const { AudioContextMock, bufferSource } = createMockAudioContextForUnlock()
    window.AudioContext = AudioContextMock

    const result = unlockAudio()

    expect(bufferSource.start).toHaveBeenCalledWith(0)
    expect(synth.speak).toHaveBeenCalledTimes(1)
    expect(synth.speak.mock.calls[0][0].text).toBe('Audio ready')
    expect(result).toEqual({ ok: true })
  })

  it('returns { ok: false } rather than throwing when speechSynthesis is unavailable and AudioContext construction throws', () => {
    delete window.speechSynthesis
    function ThrowingAudioContext() {
      throw new Error('blocked')
    }
    window.AudioContext = ThrowingAudioContext

    const result = unlockAudio()

    expect(result).toEqual({ ok: false, reason: 'unsupported' })
  })
})
