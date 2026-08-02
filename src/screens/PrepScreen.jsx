import { useEffect, useMemo, useRef, useState } from 'react'
import { useNow } from '../hooks/useNow.js'
import { clockService } from '../services/clock.js'
import { C2 } from '../data/timeline.js'
import { CHECKLIST_STORAGE_KEY, checklistProgress } from '../data/checklist.js'
import { formatDuration } from '../lib/formatDuration.js'
import { formatUtcTime } from '../lib/formatTime.js'
import { getItem } from '../services/storage.js'
import ChecklistSection from '../components/ChecklistSection.jsx'
import SettingsPanel from '../components/SettingsPanel.jsx'
import RehearsalPanel, { RehearsalBanner } from '../components/RehearsalPanel.jsx'

// Verbatim from eclipse-timer-spec.md §5.3 — do not reformat the numbers.
const REFERENCE_CARD_LINES = [
  'Bracket (C2): base 1/50 → 1/3200 · 1/800 · 1/200 · 1/50 · 1/13 · 0.3" · 1.3"',
  'Partial (C1, filter on): 1/400   |   Diamond ring (C4): 1/2500',
  'Earthshine (C3, ISO 1600): 1.3" / 2.5" / 5"',
  'Zoom 250 = corona (2.8 × 3.8 Rs)  ·  Zoom 500 = prominences (1.4 × 1.9 Rs)',
]

const C2_MS = Date.parse(C2)

// The hamburger menu's destinations. Settings is deliberately NOT here —
// it opens as a modal from the gear button instead, since it's cross-
// cutting configuration rather than a prep destination.
const SECTIONS = [
  { id: 'checklist', label: 'Checklist' },
  { id: 'reference', label: 'Reference card' },
  { id: 'rehearsal', label: 'Rehearsal' },
]

/**
 * Formats a countdown/elapsed delta as `T− HH:MM:SS` before C2, switching to
 * `T+ HH:MM:SS` once C2 has passed (spec §5, §14 AC) — the operator can now
 * navigate back to this screen from the live timeline at any point (the
 * "← Setup" button), including after C2, so a countdown frozen at
 * "T− 00:00:00" forever past that instant would be misleading.
 *
 * The remaining (T−) side ceils, never floors: matching NextAction.jsx's
 * own stated convention, showing "00:00:00" for the entire final second
 * before C2 would under-report and read as early. The elapsed (T+) side
 * floors, which is correct for elapsed time (a partially-elapsed second
 * hasn't fully elapsed yet).
 */
function formatCountdown(deltaMs) {
  if (deltaMs < 0) {
    return `T+ ${formatDuration(Math.floor(-deltaMs / 1000))}`
  }

  return `T− ${formatDuration(Math.ceil(deltaMs / 1000))}`
}

function MenuIcon() {
  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </svg>
  )
}

function GearIcon() {
  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

const ICON_BUTTON_CLASS =
  'flex h-11 w-11 items-center justify-center border border-line bg-panel/70 text-dim transition-colors hover:border-corona hover:text-corona'

const PANEL_HEADER_CLASS = 'font-display text-base font-medium tracking-[0.25em] uppercase text-dim'

/**
 * Closes the topmost open overlay on Escape. Registered only while an
 * overlay is actually open, so the listener costs nothing the rest of the
 * time.
 */
function useEscapeToClose(isOpen, onClose) {
  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    function onKeyDown(event) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])
}

function PrepScreen({ onGoLive }) {
  const now = useNow(clockService)
  const countdown = useMemo(() => formatCountdown(C2_MS - now), [now])
  const pastC2 = C2_MS - now < 0

  const [view, setView] = useState('home')
  const [menuOpen, setMenuOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const menuButtonRef = useRef(null)
  const gearButtonRef = useRef(null)
  const backButtonRef = useRef(null)
  // True only between a navigation (openSection / the back button) and the
  // focus handoff effect below — guards against the effect stealing focus
  // on the initial mount, where view is 'home' without any navigation.
  const didNavigateRef = useRef(false)

  // Recomputed every render — `now` ticks 4×/s, and the checklist is edited
  // on a different view of this same screen, so reading storage fresh keeps
  // the home percentages current without lifting ChecklistSection's state.
  const progress = checklistProgress(getItem(CHECKLIST_STORAGE_KEY, {}))
  const overallDone = progress.reduce((sum, group) => sum + group.done, 0)
  const overallTotal = progress.reduce((sum, group) => sum + group.total, 0)
  const overallPercent = overallTotal === 0 ? 0 : Math.round((overallDone / overallTotal) * 100)

  function closeMenu() {
    setMenuOpen(false)
    menuButtonRef.current?.focus()
  }

  function closeSettings() {
    setSettingsOpen(false)
    gearButtonRef.current?.focus()
  }

  function openSection(sectionId) {
    if (sectionId === view) {
      // Re-selecting the already-open section: setView would be a no-op, so
      // the [view]-keyed focus effect below would never run — hand focus to
      // the back button directly instead of letting it drop to <body> when
      // the drawer (and the activated menu item with it) unmounts.
      setMenuOpen(false)
      backButtonRef.current?.focus()
      return
    }

    didNavigateRef.current = true
    setView(sectionId)
    setMenuOpen(false)
  }

  function goHome() {
    didNavigateRef.current = true
    setView('home')
  }

  // Focus handoff after navigation: the element the user activated (a menu
  // item, or the back button) unmounts with the old view, which would drop
  // focus to <body> and force keyboard/screen-reader users to re-traverse
  // the document. Land on the section's back button, or the hamburger when
  // returning home.
  useEffect(() => {
    if (!didNavigateRef.current) {
      return
    }
    didNavigateRef.current = false

    if (view === 'home') {
      menuButtonRef.current?.focus()
    } else {
      backButtonRef.current?.focus()
    }
  }, [view])

  // One listener, topmost overlay only — with both somehow open (the drawer
  // has no focus trap, so the gear button is still keyboard-reachable
  // behind it), a single Escape must not dismiss both at once.
  useEscapeToClose(menuOpen || settingsOpen, settingsOpen ? closeSettings : closeMenu)

  return (
    <div className="min-h-dvh pb-24">
      {/* Sticky as one unit so the menu/settings controls never scroll
          away — and, while rehearsing, the warning stripe stays pinned
          with them instead of disappearing off the top of a long
          checklist. */}
      <div className="sticky top-0 z-10 bg-void/85 backdrop-blur-sm">
        <RehearsalBanner />
        <div className="mx-auto flex max-w-md items-center justify-between px-3 py-3">
          <button
            ref={menuButtonRef}
            type="button"
            aria-label="Menu"
            className={ICON_BUTTON_CLASS}
            onClick={() => setMenuOpen(true)}
          >
            <MenuIcon />
          </button>
          <button
            ref={gearButtonRef}
            type="button"
            aria-label="Settings"
            className={ICON_BUTTON_CLASS}
            onClick={() => setSettingsOpen(true)}
          >
            <GearIcon />
          </button>
        </div>
      </div>

      {view === 'home' ? (
        <>
          <header className="mx-auto flex max-w-md flex-col items-center px-4 pt-6 text-center">
            <h1 className="rise font-display text-2xl font-medium tracking-[0.45em] uppercase text-ink">
              Eclipse Timer
            </h1>
            <p className="rise mt-2 font-mono text-[0.65rem] tracking-[0.3em] uppercase text-dim [animation-delay:80ms]">
              Total solar eclipse · Ólafsvík · 12 Aug 2026
            </p>

            <div
              aria-hidden="true"
              className="rise relative mt-10 mb-9 h-36 w-36 [animation-delay:160ms]"
            >
              <div className="corona-glow absolute -inset-3 rounded-full" />
              <div className="moon-disc absolute inset-0 rounded-full" />
            </div>

            <p className="rise font-mono text-[clamp(2.3rem,10.5vw,3.4rem)] font-semibold tracking-tight tabular-nums [animation-delay:240ms]">
              {countdown}
            </p>
            <p className="rise mt-1 font-mono text-[0.65rem] tracking-[0.3em] uppercase text-corona/80 [animation-delay:300ms]">
              {pastC2 ? 'since second contact — totality' : 'to second contact — totality'}
            </p>

            <button
              type="button"
              onClick={onGoLive}
              className="rise mt-9 w-full max-w-sm border border-corona bg-corona px-6 py-4 font-display text-3xl font-bold tracking-[0.3em] uppercase text-black shadow-[0_0_28px_rgb(255_179_71/0.35)] transition hover:bg-ember hover:shadow-[0_0_44px_rgb(255_139_61/0.5)] active:translate-y-px [animation-delay:360ms]"
            >
              GO LIVE →
            </button>
          </header>

          <main className="mx-auto mt-10 w-full max-w-md px-4">
            <section className="rise border border-line bg-panel/70 [animation-delay:420ms]">
              <h2
                className={`flex min-h-12 items-center border-b border-line px-4 ${PANEL_HEADER_CLASS}`}
              >
                Setup status
              </h2>
              {progress.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => openSection('checklist')}
                  className="flex min-h-13 w-full items-center gap-3 border-b border-line/60 px-4 text-left transition-colors last:border-0 hover:bg-void/40"
                >
                  {/* Completion styling keys on done === total, not the
                      rounded percent — a big-enough group would round to
                      100% one item early. */}
                  <span className="flex-1 text-sm text-ink/90">{group.title}</span>
                  <span aria-hidden="true" className="h-1 w-16 shrink-0 overflow-hidden bg-line">
                    <span
                      className={`block h-full ${group.done === group.total ? 'bg-corona' : 'bg-dim'}`}
                      style={{ width: `${group.percent}%` }}
                    />
                  </span>
                  <span
                    className={`w-10 shrink-0 text-right font-mono text-xs tabular-nums ${
                      group.done === group.total ? 'text-corona' : 'text-dim'
                    }`}
                  >
                    {group.percent}%
                  </span>
                </button>
              ))}
            </section>
          </main>
        </>
      ) : (
        <main className="mx-auto mt-6 w-full max-w-md px-4">
          {/* Each section view keeps a document h1 — visually the section's
              own h2 header carries the context. */}
          <h1 className="sr-only">Eclipse Timer</h1>
          <button
            ref={backButtonRef}
            type="button"
            onClick={goHome}
            className="mb-3 min-h-11 px-1 font-mono text-xs tracking-[0.2em] uppercase text-dim transition-colors hover:text-corona"
          >
            ← Home
          </button>

          {view === 'checklist' && <ChecklistSection />}

          {view === 'reference' && (
            <section className="border border-line bg-panel/70">
              <h2
                className={`flex min-h-14 items-center border-b border-line px-4 ${PANEL_HEADER_CLASS}`}
              >
                Reference card
              </h2>
              <div className="px-4 py-2">
                {REFERENCE_CARD_LINES.map((line) => (
                  <p
                    key={line}
                    className="border-b border-line/60 py-2 font-mono text-xs leading-relaxed text-ink/90 last:border-0"
                  >
                    {line}
                  </p>
                ))}
              </div>
            </section>
          )}

          {view === 'rehearsal' && (
            <section className="border border-line bg-panel/70">
              <h2
                className={`flex min-h-14 items-center border-b border-line px-4 ${PANEL_HEADER_CLASS}`}
              >
                Rehearsal
              </h2>
              {/* Live clock readout — the concrete feedback that a jump-to
                  actually moved the clock. Without it, selecting a starting
                  point changed nothing visible on this view (the countdown
                  lives on the home hero), which read as the selection
                  silently failing. */}
              <p className="flex items-center justify-between border-b border-line/60 px-4 py-2 font-mono text-xs">
                <span className="tracking-[0.2em] uppercase text-dim">Clock · UTC</span>
                <span className="tabular-nums text-corona">
                  {formatUtcTime(now)} · {countdown}
                </span>
              </p>
              <div className="px-4 py-4">
                <RehearsalPanel />
              </div>
            </section>
          )}
        </main>
      )}

      {menuOpen && (
        <div className="fixed inset-0 z-20">
          {/* Pointer-only dismiss surface; keyboard users have Escape and
              the labelled close button below. */}
          <div className="absolute inset-0 bg-black/70" onClick={closeMenu} />
          <nav
            aria-label="Sections"
            className="absolute top-0 left-0 flex h-full w-72 flex-col border-r border-line bg-panel p-3"
          >
            <div className="mb-2 flex items-center justify-between pl-2">
              <span className={PANEL_HEADER_CLASS}>Sections</span>
              <button
                type="button"
                aria-label="Close menu"
                autoFocus
                className={ICON_BUTTON_CLASS}
                onClick={closeMenu}
              >
                <span aria-hidden="true" className="font-mono text-base">
                  ×
                </span>
              </button>
            </div>
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => openSection(section.id)}
                aria-current={view === section.id ? 'page' : undefined}
                className="flex min-h-14 w-full items-center justify-between px-2 text-left font-display text-lg font-medium tracking-[0.2em] uppercase text-ink transition-colors hover:text-corona aria-[current]:text-corona"
              >
                {section.label}
                {section.id === 'checklist' && (
                  <span aria-hidden="true" className="font-mono text-xs tabular-nums text-dim">
                    {overallPercent}%
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      )}

      {settingsOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Settings"
          className="fixed inset-0 z-20 flex items-center justify-center p-4"
        >
          <div className="absolute inset-0 bg-black/70" onClick={closeSettings} />
          <div className="relative max-h-[85dvh] w-full max-w-md overflow-y-auto border border-line bg-panel">
            <div className="sticky top-0 flex min-h-14 items-center justify-between border-b border-line bg-panel pr-2 pl-4">
              <span className={PANEL_HEADER_CLASS}>Settings</span>
              <button
                type="button"
                aria-label="Close settings"
                autoFocus
                className={ICON_BUTTON_CLASS}
                onClick={closeSettings}
              >
                <span aria-hidden="true" className="font-mono text-base">
                  ×
                </span>
              </button>
            </div>
            <div className="px-4 py-4">
              <SettingsPanel />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PrepScreen
