import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'

// vite.config.js's registerType: 'autoUpdate' only reloads open tabs/installed
// PWA instances onto a new deploy if something actually calls registerSW() —
// without this, the plugin's own auto-injected registration script only
// registers the service worker, with no listener for "a new one just took
// over," leaving an already-open tab (or an already-installed home-screen
// instance) silently stuck on whatever version it first loaded.
registerSW({ immediate: true })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
