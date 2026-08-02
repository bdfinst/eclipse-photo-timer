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
  const [showHomeScreenBanner, setShowHomeScreenBanner] = useState(false)
  const [screen, setScreen] = useState('prep')
  // Carried into LiveScreen so a warning chip can render immediately if the
  // GO LIVE gesture's unlock attempt failed — the gesture already happened
  // once, successful or not, so LiveScreen must not re-prompt via its own
  // tap-to-enable overlay (Step 9.2).
  const [audioStatus, setAudioStatus] = useState('pending')

  useEffect(() => {
    if (!getItem(HOME_SCREEN_BANNER_SEEN_KEY, false)) {
      setShowHomeScreenBanner(true)
      setItem(HOME_SCREEN_BANNER_SEEN_KEY, true)
    }
  }, [])

  function handleGoLive() {
    const result = unlockAudio()
    // Always switch screens, even on unlock failure — the operator must
    // never be blocked from the live screen because audio confirmation
    // couldn't be verified.
    setAudioStatus(audioStatusFromResult(result))
    setScreen('live')
  }

  return (
    <>
      {showHomeScreenBanner && (
        <p role="status" className="bg-white/10 px-4 py-2 text-sm">
          {HOME_SCREEN_BANNER_TEXT}
        </p>
      )}
      {screen === 'prep' ? (
        <PrepScreen onGoLive={handleGoLive} />
      ) : (
        <LiveScreen initialAudioStatus={audioStatus} />
      )}
    </>
  )
}

export default App
