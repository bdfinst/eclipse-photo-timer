import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { speak } from './audio.js'

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
