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
