/**
 * Speech and tone generation for the live timeline. Every function returns
 * { ok: true } or { ok: false, reason } rather than throwing — audio is a
 * secondary confirmation channel, not something that may crash the app.
 */

function pickVoice(synth) {
  const voices = typeof synth.getVoices === 'function' ? synth.getVoices() : []

  return (
    voices.find((voice) => voice.lang === 'en-GB') ??
    voices.find((voice) => voice.lang === 'en-US') ??
    null
  )
}

export function speak(text) {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    return { ok: false, reason: 'unsupported' }
  }

  const synth = window.speechSynthesis
  synth.cancel()

  const utterance = new SpeechSynthesisUtterance(text)
  utterance.rate = 1.0
  utterance.volume = 1.0

  const voice = pickVoice(synth)
  if (voice) {
    utterance.voice = voice
  }

  synth.speak(utterance)

  return { ok: true }
}

function scheduleTone(ctx, freq, durationMs, gain = 1, startTime = ctx.currentTime) {
  const oscillator = ctx.createOscillator()
  const gainNode = ctx.createGain()

  oscillator.type = 'sine'
  oscillator.frequency.value = freq
  gainNode.gain.value = gain

  oscillator.connect(gainNode)
  gainNode.connect(ctx.destination)

  oscillator.start(startTime)
  oscillator.stop(startTime + durationMs / 1000)

  return oscillator
}

export const AUDIO_CUES = ['non-critical-due', 'critical-warning', 'critical-due', 'filter-toggle']

const CUE_SCHEDULES = {
  'non-critical-due': (ctx) => scheduleTone(ctx, 660, 120),
  'critical-warning': (ctx) => scheduleTone(ctx, 880, 80),
  'critical-due': (ctx) => {
    for (let blip = 0; blip < 3; blip += 1) {
      scheduleTone(ctx, 1320, 100, 1, ctx.currentTime + blip * 0.1)
    }
  },
  'filter-toggle': (ctx) => {
    scheduleTone(ctx, 600, 300, 1.2)
    scheduleTone(ctx, 1400, 300, 1.2, ctx.currentTime + 0.3)
  },
}

function getAudioContextClass() {
  return typeof window === 'undefined'
    ? undefined
    : (window.AudioContext ?? window.webkitAudioContext)
}

export function playTone(cue) {
  const schedule = CUE_SCHEDULES[cue]

  if (!schedule) {
    return { ok: false, reason: 'unsupported' }
  }

  const AudioContextClass = getAudioContextClass()

  if (!AudioContextClass) {
    return { ok: false, reason: 'unsupported' }
  }

  try {
    const ctx = new AudioContextClass()
    schedule(ctx)
    return { ok: true }
  } catch {
    return { ok: false, reason: 'unsupported' }
  }
}

/**
 * Catch-up rule (spec §7.4): an event's announcement instant is
 * `eventAt - leadSeconds` seconds. If that instant is already in the past
 * relative to `now`, the event must never be announced.
 */
export function shouldAnnounce(eventAt, now, leadSeconds) {
  const announceAt = eventAt - leadSeconds * 1000

  return announceAt >= now
}

function playSilentBuffer() {
  const AudioContextClass = getAudioContextClass()

  if (!AudioContextClass) {
    return { ok: false, reason: 'unsupported' }
  }

  try {
    const ctx = new AudioContextClass()
    const buffer = ctx.createBuffer(1, 1, 22050)
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)
    source.start(0)
    return { ok: true }
  } catch {
    return { ok: false, reason: 'unsupported' }
  }
}

/**
 * The GO LIVE unlock gesture (spec §7.1): plays a silent buffer through the
 * AudioContext, then speaks a confirmation phrase, so the browser's
 * user-gesture requirement is satisfied for the rest of the run. Returns
 * { ok: true } only if both steps succeeded — the caller needs to know
 * "unlocked" from "silently did nothing".
 */
export function unlockAudio() {
  const bufferResult = playSilentBuffer()

  if (!bufferResult.ok) {
    return bufferResult
  }

  return speak('Audio ready')
}
