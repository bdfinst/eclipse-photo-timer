import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { playTone, speak } from './audio.js'

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
