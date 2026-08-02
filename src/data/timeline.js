/**
 * Eclipse timeline event data — transcribed verbatim from eclipse-timer-spec.md §4.2.
 * Do not recompute or "improve" the times.
 *
 * @typedef {'prep'|'partial-1'|'handover-in'|'totality'|'handover-out'|'partial-2'|'done'} Phase
 */

/**
 * @typedef {'C1'|'C2'|'C3'|'C4'|null} Mode
 */

/**
 * @typedef {Object} TimelineEvent
 * @property {string} id
 * @property {string} at - absolute UTC ISO-8601
 * @property {Phase} phase
 * @property {Mode} mode - camera custom mode chip, or null
 * @property {string} title - imperative, short — this is what gets spoken
 * @property {string} [detail] - secondary line, not spoken
 * @property {boolean} critical - drives styling, audio priority, and countdown targeting
 * @property {boolean} filterOn - state of the solar filter AFTER this event
 * @property {string} [speak] - override for TTS if the title reads badly aloud
 * @property {number} [leadSeconds] - announce this many seconds early (default 10 for critical, 0 otherwise)
 */

// Anchor times (Ólafsvík, 64.8945 N, 23.7108 W) — spec §4.1.
export const C1 = '2026-08-12T16:47:00Z'
export const C2 = '2026-08-12T17:46:10Z'
export const C3 = '2026-08-12T17:48:13Z'
export const C4 = '2026-08-12T18:47:00Z'

/** @type {TimelineEvent[]} */
export const EVENTS = [
  // ---------- setup ----------
  {
    id: 'setup',
    at: '2026-08-12T15:45:00Z',
    phase: 'prep',
    mode: null,
    critical: false,
    filterOn: true,
    title: 'Set up and polar align',
    detail:
      'Tripod level, GTi on solar rate in SynScan, payload balanced at the 250 zoom mark, camera-heavy.',
  },

  {
    id: 'focus',
    at: '2026-08-12T16:15:00Z',
    phase: 'prep',
    mode: 'C1',
    critical: false,
    filterOn: true,
    title: 'Focus and lock',
    detail:
      'Filter on. Zoom 250. Focus a sunspot at 14× magnified live view, then Focus Ring Lock and tape the ring.',
  },

  {
    id: 'dryrun',
    at: '2026-08-12T16:30:00Z',
    phase: 'prep',
    mode: 'C2',
    critical: false,
    filterOn: true,
    title: 'Dry run the totality bracket',
    detail:
      'Fire one dial-C2 burst at the filtered sun. Confirm seven RAWs land, including the 1.3-second frame.',
  },

  {
    id: 'power',
    at: '2026-08-12T16:40:00Z',
    phase: 'prep',
    mode: null,
    critical: false,
    filterOn: true,
    title: 'Connect USB power',
    detail:
      'Camera off, plug in the ≥27 W PD bank, power on, confirm USBP on the display. Charged battery still in the body.',
  },

  {
    id: 'arm',
    at: '2026-08-12T16:45:00Z',
    phase: 'prep',
    mode: 'C1',
    critical: true,
    filterOn: true,
    title: 'Arm the timer',
    detail: 'JJC TM-J2: DELAY 0, LONG 1s, INTVL 4s, N = 826. Drive Single. Do not start yet.',
  },

  // ---------- ingress partials ----------
  {
    id: 'c1',
    at: '2026-08-12T16:47:00Z',
    phase: 'partial-1',
    mode: 'C1',
    critical: true,
    filterOn: true,
    title: 'First contact — start the timer',
    speak: 'First contact. Start the timer now.',
    detail: '826 frames at 4 seconds. Last frame 17:42:00. Hands off the rig from here.',
  },

  {
    id: 'check-1',
    at: '2026-08-12T17:00:00Z',
    phase: 'partial-1',
    mode: null,
    critical: false,
    filterOn: true,
    title: 'Quiet check',
    detail:
      'Frame count advancing, sun still centred, filter still taped. Do not recentre — it puts a jump in the time-lapse.',
  },

  {
    id: 'check-2',
    at: '2026-08-12T17:25:00Z',
    phase: 'partial-1',
    mode: null,
    critical: false,
    filterOn: true,
    title: 'Quiet check',
    detail: 'Last look before the run ends. Confirm power, card space, and that nothing has crept.',
  },

  // ---------- hand-flown ingress ----------
  {
    id: 'handover-in',
    at: '2026-08-12T17:42:00Z',
    phase: 'handover-in',
    mode: 'C1',
    critical: true,
    filterOn: true,
    title: 'Timer done — you have the camera',
    speak: 'Timer finished. You have the camera. Open up one half stop.',
    detail: 'Frame 826 is in. Open +½ stop for limb darkening. Shoot by hand from here.',
  },

  {
    id: 'ramp-full',
    at: '2026-08-12T17:45:10Z',
    phase: 'handover-in',
    mode: 'C1',
    critical: true,
    filterOn: true,
    title: 'Open up one stop',
    detail:
      'Only the limb is left and it is ~1.5 stops darker than disk centre. One minute to totality.',
  },

  {
    id: 'final-check',
    at: '2026-08-12T17:45:40Z',
    phase: 'handover-in',
    mode: 'C4',
    critical: true,
    filterOn: true,
    title: 'Final check — zoom 500, hand on the filter',
    speak: 'Final check. Zoom five hundred. Hand on the filter.',
    detail:
      'Sun centred, camera awake, MF locked, dial C4 armed, ProCap half-pressed. Thirty seconds.',
  },

  // ---------- totality ----------
  {
    id: 'c2',
    at: '2026-08-12T17:46:10Z',
    phase: 'totality',
    mode: 'C4',
    critical: true,
    filterOn: false,
    title: 'FILTER OFF — diamond ring',
    speak: 'Filter off. Filter off. Shoot the diamond ring.',
    detail: 'ProCap burst. Second contact.',
  },

  {
    id: 'burst-1',
    at: '2026-08-12T17:46:15Z',
    phase: 'totality',
    mode: 'C2',
    critical: true,
    filterOn: false,
    title: 'Bracket burst 1',
    detail: 'Tight at zoom 500 — chromosphere and prominences.',
  },

  {
    id: 'burst-2',
    at: '2026-08-12T17:46:25Z',
    phase: 'totality',
    mode: 'C2',
    critical: true,
    filterOn: false,
    title: 'Bracket burst 2',
    detail: 'Second look at the prominences.',
  },

  {
    id: 'zoom',
    at: '2026-08-12T17:46:40Z',
    phase: 'totality',
    mode: null,
    critical: true,
    filterOn: false,
    title: 'ZOOM BACK TO 250',
    speak: 'Zoom back to two fifty. Recentre.',
    detail:
      'Pull to the taped mark. Recentre. If it fights you, abandon it and keep shooting tight.',
  },

  {
    id: 'burst-3',
    at: '2026-08-12T17:46:48Z',
    phase: 'totality',
    mode: 'C2',
    critical: true,
    filterOn: false,
    title: 'Bracket burst 3 — the corona',
    detail: 'This is the picture.',
  },

  {
    id: 'earthshine',
    at: '2026-08-12T17:46:56Z',
    phase: 'totality',
    mode: 'C3',
    critical: false,
    filterOn: false,
    title: 'Outer corona / earthshine',
    detail: 'ISO 1600. Sweep 1.3s, 2.5s, 5s. Stretch goal — do not overrun.',
  },

  {
    id: 'lookup',
    at: '2026-08-12T17:47:10Z',
    phase: 'totality',
    mode: null,
    critical: true,
    filterOn: false,
    title: 'HANDS OFF — LOOK UP',
    speak: 'Hands off. Look up. Twenty five seconds.',
    detail: 'This is the whole point. Do not touch the camera.',
  },

  {
    id: 'burst-4',
    at: '2026-08-12T17:47:35Z',
    phase: 'totality',
    mode: 'C2',
    critical: true,
    filterOn: false,
    title: 'Bracket burst 4 — corona',
    detail: 'Recentre first; the sun has drifted west.',
  },

  {
    id: 'arm-c3',
    at: '2026-08-12T17:47:50Z',
    phase: 'totality',
    mode: 'C4',
    critical: true,
    filterOn: false,
    title: 'Arm for third contact',
    speak: 'Arm for third contact. Watch the west limb.',
    detail: 'Still at 250. Beads first, then the diamond ring with the full corona around it.',
  },

  // ---------- egress ----------
  {
    id: 'c3',
    at: '2026-08-12T17:48:13Z',
    phase: 'handover-out',
    mode: 'C1',
    critical: true,
    filterOn: true,
    title: 'FILTER BACK ON — eyes away',
    speak: 'Filter on. Filter on now. Eyes away.',
    detail: 'Third contact. Filter on before the first bead, not after. Then back to +1 stop.',
  },

  {
    id: 'ramp-down-1',
    at: '2026-08-12T17:49:15Z',
    phase: 'handover-out',
    mode: 'C1',
    critical: false,
    filterOn: true,
    title: 'Back to +½ stop',
    detail: 'Mirror of the ingress ramp as the crescent widens.',
  },

  {
    id: 'ramp-down-2',
    at: '2026-08-12T17:51:30Z',
    phase: 'handover-out',
    mode: 'C1',
    critical: false,
    filterOn: true,
    title: 'Back to base exposure — 1/400',
    detail: 'Reset for the second timer run. Confirm zoom is still 250 so the clips match.',
  },

  {
    id: 'run-2',
    at: '2026-08-12T17:52:00Z',
    phase: 'partial-2',
    mode: 'C1',
    critical: true,
    filterOn: true,
    title: 'Start timer run 2',
    speak: 'Start the second timer run.',
    detail: 'Identical program: INTVL 4s, N = 826. Last frame 18:47:00.',
  },

  {
    id: 'check-3',
    at: '2026-08-12T18:15:00Z',
    phase: 'partial-2',
    mode: null,
    critical: false,
    filterOn: true,
    title: 'Quiet check',
    detail: 'Power, card, framing. Then leave it alone.',
  },

  {
    id: 'c4',
    at: '2026-08-12T18:47:00Z',
    phase: 'done',
    mode: null,
    critical: true,
    filterOn: true,
    title: 'Fourth contact — done',
    speak: 'Fourth contact. That is the eclipse.',
    detail: '1652 frames, about 29 GB. Back up the card before you do anything else.',
  },
]
