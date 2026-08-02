import { useEffect, useState } from 'react'
import { getItem, setItem } from './services/storage.js'
import { unlockAudio } from './services/audio.js'
import { audioStatusFromResult } from './hooks/useAudioUnlock.js'
import PrepScreen from './screens/PrepScreen.jsx'
import LiveScreen from './screens/LiveScreen.jsx'

export const HOME_SCREEN_BANNER_SEEN_KEY = 'eclipse.homeScreenBannerSeen'
export const HOME_SCREEN_BANNER_TEXT =
  'Add to Home Screen and open it once offline before you travel.'

function App() {
  // Computed once, directly, from the persisted flag — not derived via an
  // effect-triggered setState (avoids a same-mount extra re-render, and the
  // banner's own visibility never needs to change reactively afterward).
  const [showHomeScreenBanner] = useState(() => !getItem(HOME_SCREEN_BANNER_SEEN_KEY, false))
  const [screen, setScreen] = useState('prep')
  // Carried into LiveScreen so a warning chip can render immediately if the
  // GO LIVE gesture's unlock attempt failed — the gesture already happened
  // once, successful or not, so LiveScreen must not re-prompt via its own
  // tap-to-enable overlay (Step 9.2).
  const [audioStatus, setAudioStatus] = useState('pending')

  useEffect(() => {
    if (showHomeScreenBanner) {
      setItem(HOME_SCREEN_BANNER_SEEN_KEY, true)
    }
  }, [showHomeScreenBanner])

  function handleGoLive() {
    const result = unlockAudio()
    // Always switch screens, even on unlock failure — the operator must
    // never be blocked from the live screen because audio confirmation
    // couldn't be verified.
    setAudioStatus(audioStatusFromResult(result))
    setScreen('live')
  }

  function handleBackToPrep() {
    setScreen('prep')
  }

  return (
    <>
      {showHomeScreenBanner && (
        <p
          role="status"
          className="border-b border-line bg-panel/80 px-4 py-2 text-center font-mono text-xs text-dim"
        >
          {HOME_SCREEN_BANNER_TEXT}
        </p>
      )}
      {screen === 'prep' ? (
        <PrepScreen onGoLive={handleGoLive} />
      ) : (
        <LiveScreen initialAudioStatus={audioStatus} onBack={handleBackToPrep} />
      )}
    </>
  )
}

export default App
