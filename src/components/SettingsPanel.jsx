import { useEffect, useState } from 'react'
import { getItem, setItem } from '../services/storage.js'
import { CHECKBOX_CLASS, TOGGLE_LABEL_CLASS } from './formClasses.js'
import {
  AUDIO_CUES,
  AUDIO_MASTER_KEY,
  AUDIO_TONES_KEY,
  AUDIO_VOICE_KEY,
  playTone,
  speak,
} from '../services/audio.js'

// Re-exported for backward compatibility — these keys now live canonically
// in audio.js (see that module for why), but SettingsPanel is still where
// the UI for toggling them lives.
export { AUDIO_MASTER_KEY, AUDIO_VOICE_KEY, AUDIO_TONES_KEY }

export const CLOCK_OFFSET_KEY = 'eclipse.clockOffsetMs'
export const KEEP_AWAKE_KEY = 'eclipse.keepAwakeOn'

// Longest cue (filter-toggle) runs 600ms (audio.js), so 700ms between cue
// starts guarantees no overlap between "Test audio"'s sequential cues.
const TEST_AUDIO_CUE_GAP_MS = 700

const STEPPER_BUTTON_CLASS =
  'min-h-11 min-w-11 border border-line bg-void px-2 font-mono text-sm text-ink transition-colors hover:border-corona hover:text-corona'

function formatOffset(offsetMs) {
  const seconds = offsetMs / 1000
  const sign = seconds >= 0 ? '+' : '−'

  return `${sign}${Math.abs(seconds)}s`
}

function pad(n) {
  return String(n).padStart(2, '0')
}

// Raw device clock — deliberately Date.now(), not clockService.now(). Spec
// §3.2 calls for the UNadjusted device time here, so the operator has
// something to compare against time.is/GPS before setting the offset.
function formatDeviceTime(date) {
  return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`
}

// Read/write a persisted boolean setting, defaulting to `true` (every
// setting this hook backs — audio master/voice/tones, keep-awake — defaults
// on). Extracted once the four toggles below turned out to share identical
// read/toggle/persist logic (Step 5.4 REFACTOR).
function useSettingToggle(key) {
  const [value, setValue] = useState(() => getItem(key, true))

  function toggle() {
    const next = !value
    setValue(next)
    setItem(key, next)
  }

  return [value, toggle]
}

function SettingsPanel() {
  const [offsetMs, setOffsetMs] = useState(() => {
    const raw = getItem(CLOCK_OFFSET_KEY, 0)
    return Number.isFinite(raw) ? raw : 0
  })
  const [deviceTime, setDeviceTime] = useState(() => new Date())
  const [audioMasterOn, toggleAudioMaster] = useSettingToggle(AUDIO_MASTER_KEY)
  const [audioVoiceOn, toggleAudioVoice] = useSettingToggle(AUDIO_VOICE_KEY)
  const [audioTonesOn, toggleAudioTones] = useSettingToggle(AUDIO_TONES_KEY)
  const [keepAwakeOn, toggleKeepAwake] = useSettingToggle(KEEP_AWAKE_KEY)

  useEffect(() => {
    const intervalId = setInterval(() => setDeviceTime(new Date()), 1000)
    return () => clearInterval(intervalId)
  }, [])

  function adjustOffset(deltaMs) {
    const next = offsetMs + deltaMs
    setOffsetMs(next)
    setItem(CLOCK_OFFSET_KEY, next)
  }

  function resetOffset() {
    setOffsetMs(0)
    setItem(CLOCK_OFFSET_KEY, 0)
  }

  function testAudio() {
    speak('Audio ready')
    AUDIO_CUES.forEach((cue, index) => {
      setTimeout(() => playTone(cue), index * TEST_AUDIO_CUE_GAP_MS)
    })
  }

  return (
    <section className="flex flex-col gap-4">
      {/* The enclosing module's summary row already reads "Settings" — keep
          the heading for document structure, hidden visually. */}
      <h2 className="sr-only">Settings</h2>

      <div className="text-center">
        <p className="font-mono text-4xl font-medium tabular-nums text-corona">
          {formatDeviceTime(deviceTime)}
        </p>
        <p className="mt-1 font-mono text-[0.65rem] tracking-[0.3em] uppercase text-dim">
          Device clock · UTC
        </p>
      </div>

      <p className="text-sm leading-relaxed text-dim">
        Check against time.is or a GPS clock while you still have signal. Positive offset means the
        app runs ahead of your phone.
      </p>

      <div className="flex items-center justify-center gap-1.5">
        <button type="button" className={STEPPER_BUTTON_CLASS} onClick={() => adjustOffset(-10000)}>
          −10s
        </button>
        <button type="button" className={STEPPER_BUTTON_CLASS} onClick={() => adjustOffset(-1000)}>
          −1s
        </button>
        <span className="min-w-16 text-center font-mono text-base font-semibold tabular-nums text-corona">
          {formatOffset(offsetMs)}
        </span>
        <button type="button" className={STEPPER_BUTTON_CLASS} onClick={() => adjustOffset(1000)}>
          +1s
        </button>
        <button type="button" className={STEPPER_BUTTON_CLASS} onClick={() => adjustOffset(10000)}>
          +10s
        </button>
        <button
          type="button"
          className="min-h-11 px-2 font-mono text-xs text-dim transition-colors hover:text-corona"
          onClick={resetOffset}
        >
          Reset
        </button>
      </div>

      <div className="flex flex-col border-y border-line/60">
        <label className={TOGGLE_LABEL_CLASS}>
          <input
            type="checkbox"
            className={CHECKBOX_CLASS}
            checked={audioMasterOn}
            onChange={toggleAudioMaster}
          />
          Audio master
        </label>
        <label className={TOGGLE_LABEL_CLASS}>
          <input
            type="checkbox"
            className={CHECKBOX_CLASS}
            checked={audioVoiceOn}
            onChange={toggleAudioVoice}
          />
          Voice
        </label>
        <label className={TOGGLE_LABEL_CLASS}>
          <input
            type="checkbox"
            className={CHECKBOX_CLASS}
            checked={audioTonesOn}
            onChange={toggleAudioTones}
          />
          Tones
        </label>
        <label className={TOGGLE_LABEL_CLASS}>
          <input
            type="checkbox"
            className={CHECKBOX_CLASS}
            checked={keepAwakeOn}
            onChange={toggleKeepAwake}
          />
          Keep screen awake
        </label>
      </div>

      <button
        type="button"
        className="min-h-12 border border-corona/60 px-4 font-display text-lg font-medium tracking-[0.25em] uppercase text-corona transition-colors hover:bg-corona hover:text-black"
        onClick={testAudio}
      >
        Test audio
      </button>
    </section>
  )
}

export default SettingsPanel
