import { useState } from 'react'
import { unlockAudio } from './services/audio.js'
import { audioStatusFromResult } from './hooks/useAudioUnlock.js'
import { resetRehearsalSession } from './hooks/useRehearsalControls.js'
import PrepScreen from './screens/PrepScreen.jsx'
import LiveScreen from './screens/LiveScreen.jsx'

function App() {
  const [screen, setScreen] = useState('prep')
  // Carried into LiveScreen so a warning chip can render immediately if the
  // GO LIVE gesture's unlock attempt failed — the gesture already happened
  // once, successful or not, so LiveScreen must not re-prompt via its own
  // tap-to-enable overlay (Step 9.2).
  const [audioStatus, setAudioStatus] = useState('pending')

  function handleGoLive() {
    const result = unlockAudio()
    // Always switch screens, even on unlock failure — the operator must
    // never be blocked from the live screen because audio confirmation
    // couldn't be verified.
    setAudioStatus(audioStatusFromResult(result))
    setScreen('live')
  }

  function handleBackToPrep() {
    // Returning to setup mid-rehearsal ends the practice run (real clock,
    // fresh announcement/transport state). A real-clock session is a
    // strict no-op — see resetRehearsalSession's docstring.
    resetRehearsalSession()
    setScreen('prep')
  }

  return screen === 'prep' ? (
    <PrepScreen onGoLive={handleGoLive} />
  ) : (
    <LiveScreen initialAudioStatus={audioStatus} onBack={handleBackToPrep} />
  )
}

export default App
