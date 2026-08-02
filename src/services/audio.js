/**
 * Speech and tone generation for the live timeline. Every function returns
 * { ok: true } or { ok: false, reason } rather than throwing — audio is a
 * secondary confirmation channel, not something that may crash the app.
 */

// Persisted settings keys — canonical home here (not SettingsPanel.jsx,
// which just presents them) since the live announcement scheduler
// (useAnnouncements.js) reads them directly and shouldn't depend on a
// presentational component's exports.
import { getItem } from './storage.js'

export const AUDIO_MASTER_KEY = 'eclipse.audioMasterOn'
export const AUDIO_VOICE_KEY = 'eclipse.audioVoiceOn'
export const AUDIO_TONES_KEY = 'eclipse.audioTonesOn'

// The operator's explicit voice choice (a voice NAME from the device's own
// installed set, or the sentinel below for "let pickVoice decide").
// Voices are per-device, so a choice made on the laptop won't exist on the
// phone — pickVoice treats an uninstalled stored name as 'auto' rather
// than going silent.
export const VOICE_NAME_KEY = 'eclipse.voiceName'
export const VOICE_AUTO = 'auto'

/**
 * The English voices installed on this device, for the Settings picker.
 * May legitimately be empty on first call — some browsers populate
 * getVoices() only after the async 'voiceschanged' event.
 */
export function listEnglishVoices() {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    return []
  }

  const synth = window.speechSynthesis
  const voices = typeof synth.getVoices === 'function' ? synth.getVoices() : []

  return voices.filter((voice) => voice.lang === 'en-GB' || voice.lang === 'en-US')
}

// The operator's stated preference: a woman's voice, UK English accent
// first. The Web Speech API exposes no gender field, so this matches known
// female voice names per platform — Google's Chrome/Android voices state
// gender outright ("Google UK English Female"); the rest are Apple
// (Martha/Kate/Serena/Stephanie/Samantha/Ava/Allison) and Microsoft
// (Hazel/Sonia/Libby/Susan/Zira/Aria/Jenny) female voice names. An
// unrecognized voice set falls through to any UK-then-US voice rather
// than to silence.
const FEMALE_VOICE_NAME_HINTS = [
  'female',
  'martha',
  'kate',
  'serena',
  'stephanie',
  'hazel',
  'sonia',
  'libby',
  'susan',
  'samantha',
  'ava',
  'allison',
  'zira',
  'aria',
  'jenny',
]

function isLikelyFemaleVoice(voice) {
  const name = voice.name.toLowerCase()
  return FEMALE_VOICE_NAME_HINTS.some((hint) => name.includes(hint))
}

// An explicitly-chosen voice (Settings picker) always wins. Otherwise the
// auto preference order: female en-GB, then female en-US (a woman's voice
// is the hard requirement, the UK accent the tiebreaker), then any en-GB,
// any en-US, and finally the browser default (voice left unset).
function pickVoice(synth) {
  const voices = typeof synth.getVoices === 'function' ? synth.getVoices() : []

  const storedName = getItem(VOICE_NAME_KEY, VOICE_AUTO)
  if (typeof storedName === 'string' && storedName !== VOICE_AUTO) {
    const chosen = voices.find((voice) => voice.name === storedName)
    if (chosen) {
      return chosen
    }
    // Stored on another device or the voice was uninstalled — fall through
    // to auto rather than silently losing speech.
  }

  const ukVoices = voices.filter((voice) => voice.lang === 'en-GB')
  const usVoices = voices.filter((voice) => voice.lang === 'en-US')

  return (
    ukVoices.find(isLikelyFemaleVoice) ??
    usVoices.find(isLikelyFemaleVoice) ??
    ukVoices[0] ??
    usVoices[0] ??
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

// One shared AudioContext for every tone and unlock buffer, created lazily
// and resumed on each use. Sharing is load-bearing, not an optimization:
// (1) autoplay policy — a context created outside a user gesture starts
// 'suspended' and schedules its oscillators into silence, and every real
// announcement fires from a timer tick, never a gesture, so the only
// audible path is reusing the context that the GO LIVE / Test audio
// gesture created and resumed; (2) browsers cap concurrent AudioContexts
// (Chrome: six), so a fresh context per tone would go silent partway
// through the eclipse timeline regardless.
let sharedAudioContext = null

// Test-isolation-only export: lets tests drop the cached context between
// cases that install different AudioContext mocks on window.
export function resetSharedAudioContextForTests() {
  sharedAudioContext = null
}

function getSharedAudioContext() {
  const AudioContextClass = getAudioContextClass()

  if (!AudioContextClass) {
    return null
  }

  if (!sharedAudioContext) {
    try {
      sharedAudioContext = new AudioContextClass()
    } catch {
      return null
    }
  }

  if (sharedAudioContext.state === 'suspended' && typeof sharedAudioContext.resume === 'function') {
    // Fire-and-forget: inside a user gesture this unlocks the context; the
    // promise is deliberately not awaited — scheduling below queues on the
    // context either way and sounds the moment it starts running.
    sharedAudioContext.resume()
  }

  return sharedAudioContext
}

export function playTone(cue) {
  const schedule = CUE_SCHEDULES[cue]

  if (!schedule) {
    return { ok: false, reason: 'unsupported' }
  }

  const ctx = getSharedAudioContext()

  if (!ctx) {
    return { ok: false, reason: 'unsupported' }
  }

  try {
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
  const ctx = getSharedAudioContext()

  if (!ctx) {
    return { ok: false, reason: 'unsupported' }
  }

  try {
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
 * Creates/resumes the shared AudioContext from inside the caller's user
 * gesture without making an audible sound. unlockAudio() covers this for
 * the GO LIVE gesture; SettingsPanel's Test audio button calls it directly
 * so its setTimeout-scheduled cues play on an already-running context
 * rather than being silenced by autoplay policy.
 */
export function primeAudio() {
  return playSilentBuffer()
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
