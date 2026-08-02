import { useEffect, useState } from 'react'
import { getItem, setItem } from '../services/storage.js'
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
    <section>
      <h2>Settings</h2>

      <p className="text-3xl font-mono">{formatDeviceTime(deviceTime)}</p>

      <p>
        Check against time.is or a GPS clock while you still have signal. Positive offset means the
        app runs ahead of your phone.
      </p>

      <div>
        <button type="button" onClick={() => adjustOffset(-10000)}>
          −10s
        </button>
        <button type="button" onClick={() => adjustOffset(-1000)}>
          −1s
        </button>
        <span>{formatOffset(offsetMs)}</span>
        <button type="button" onClick={() => adjustOffset(1000)}>
          +1s
        </button>
        <button type="button" onClick={() => adjustOffset(10000)}>
          +10s
        </button>
        <button type="button" onClick={resetOffset}>
          Reset
        </button>
      </div>

      <label>
        <input type="checkbox" checked={audioMasterOn} onChange={toggleAudioMaster} />
        Audio master
      </label>
      <label>
        <input type="checkbox" checked={audioVoiceOn} onChange={toggleAudioVoice} />
        Voice
      </label>
      <label>
        <input type="checkbox" checked={audioTonesOn} onChange={toggleAudioTones} />
        Tones
      </label>
      <label>
        <input type="checkbox" checked={keepAwakeOn} onChange={toggleKeepAwake} />
        Keep screen awake
      </label>

      <button type="button" onClick={testAudio}>
        Test audio
      </button>
    </section>
  )
}

export default SettingsPanel
