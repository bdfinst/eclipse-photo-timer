import { useEffect, useState } from 'react'
import { getItem, setItem } from './services/storage.js'

export const HOME_SCREEN_BANNER_SEEN_KEY = 'eclipse.homeScreenBannerSeen'
export const HOME_SCREEN_BANNER_TEXT =
  'Add to Home Screen and open it once offline before you travel.'

function App() {
  const [showHomeScreenBanner, setShowHomeScreenBanner] = useState(false)

  useEffect(() => {
    if (!getItem(HOME_SCREEN_BANNER_SEEN_KEY, false)) {
      setShowHomeScreenBanner(true)
      setItem(HOME_SCREEN_BANNER_SEEN_KEY, true)
    }
  }, [])

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-2 text-center">
      {showHomeScreenBanner && (
        <p role="status" className="bg-white/10 px-4 py-2 text-sm">
          {HOME_SCREEN_BANNER_TEXT}
        </p>
      )}
      <h1 className="text-3xl font-semibold">Eclipse Timer</h1>
      <p className="text-white/60">Ólafsvík, Iceland — 12 August 2026</p>
    </main>
  )
}

export default App
