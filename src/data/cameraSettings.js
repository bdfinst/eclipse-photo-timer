/**
 * Camera-settings reference — transcribed from the operator's field card
 * (Eclipse_2026_OM1_Field_Card_4.pdf, page 1, "CAMERA SETTINGS"), as
 * amended by the operator's change requests: fixed-focal
 * (eclipse-timer-CHANGE-fixed-focal.md — zoom locked at the 500 mark,
 * constant f/13, every exposure shifted ⅓ stop), the ramp fix (+⅔ stop,
 * dial-settle guidance), and the reference-card text correction (ladder
 * subjects honest about the 1.4 Rs frame). Numbers are the change
 * requests' own — do not recompute them. The exposure ladder DERIVATIONS (page 3's Espenak Q table) and
 * rig/power notes (page 2) are deliberately not included here — this is
 * the in-field settings reference, not the planning document.
 */

export const RIG_SUMMARY =
  'OM-1 · 150-600 + MC-20 · LOCKED at the 500 mark = 1000mm true, f/13 · SafeSight ND 5.0'

/** @type {{ label: string, value: string }[]} */
export const GLOBAL_SETTINGS = [
  { label: 'Mode', value: 'M, always' },
  { label: 'Aperture', value: 'Wide open. Never stop down.' },
  { label: 'Quality', value: 'RAW' },
  { label: 'White balance', value: '5400K fixed — never Auto' },
  { label: 'Shutter type', value: '♦ Silent (electronic)' },
  { label: 'Focus', value: 'MF + Focus Ring Lock, ring taped' },
  { label: 'ISO', value: 'Fixed per mode. Never Auto.' },
  { label: 'IS', value: 'OFF — body and lens switch' },
  { label: 'Sleep / power-off', value: 'OFF' },
  { label: 'Image Review', value: 'OFF' },
  { label: 'Subject detect', value: 'OFF' },
  { label: 'Long-exposure NR', value: 'OFF' },
  { label: 'Self-timer, anti-shock', value: 'OFF' },
  { label: 'Mode retention', value: 'Reset' },
]

// Deliberate divergence from the card's bare "C1"/"C2" titles: the app
// prefixes "Dial" because the eclipse CONTACTS also go by C1–C4, and both
// appear side by side on the live screen and in rehearsal jump-tos.
export const DIAL_DISAMBIGUATION_NOTE =
  'The camera’s four custom dial modes are labelled C1–C4, and so are the eclipse contacts. “Dial Cn” always means the camera mode.'

/**
 * The four custom dial modes. `ladder` (when present) is the HDR bracket:
 * one row per frame, base frame flagged so the UI can highlight it.
 *
 * @type {{
 *   id: string,
 *   title: string,
 *   tagline: string,
 *   headline: string,
 *   ladder?: { ev: string, shutter: string, subject: string, base?: boolean }[],
 *   notes: string,
 * }[]}
 */
export const CUSTOM_MODES = [
  {
    id: 'c1',
    title: 'Dial C1 — Partial phases',
    tagline: 'filter on · both timer runs and the hand-flown minutes',
    headline: 'ISO 200 · 1/320 · Single drive',
    notes:
      'Expose off the RGB histogram, not luminance. Ramp +⅔ stop at the 17:42 handover and +1 stop at T−60s — by then only the limb is left and it averages 0.83 stops below the full disk. Mirror after C3. Turn the dial slowly and let it settle 5 s before the next frame. Stay in M — A mode meters the black moon once the crescent thins and runs away.',
  },
  {
    id: 'c2',
    title: 'Dial C2 — Totality bracket',
    tagline: 'the mode that matters · correct at every focal length',
    headline: 'ISO 200 · base 1/40 · Menu › Shooting 2 › HDR › 7f 2.0EV',
    ladder: [
      { ev: '−6 EV', shutter: '1/2500', subject: 'chromosphere' },
      { ev: '−4 EV', shutter: '1/640', subject: 'prominences' },
      { ev: '−2 EV', shutter: '1/160', subject: 'corona 0.1 Rs' },
      { ev: 'BASE', shutter: '1/40', subject: '0.2 Rs + diamond', base: true },
      { ev: '+2 EV', shutter: '1/10', subject: 'corona 0.5 Rs' },
      { ev: '+4 EV', shutter: '0.4"', subject: 'corona 1.0 Rs' },
      { ev: '+6 EV', shutter: '1.6"', subject: 'frame edge' },
    ],
    notes:
      'One press, seven RAWs, about two seconds. Not HDR1/HDR2 — those merge to JPEG and lock ISO. The zoom never moves, so nothing is ever re-dialled. +6EV targets 4.0 Rs, off the 1.4 Rs frame — it rounds out the HDR curve, not new corona.',
  },
  {
    id: 'c3',
    title: 'Dial C3 — Outer corona & earthshine',
    tagline: 'picks up where C2 stops · three attempts inside totality',
    headline: 'ISO 1600 · base 1/5 · Menu › Shooting 2 › HDR › 5f 2.0EV',
    ladder: [
      { ev: '−4 EV', shutter: '1/80', subject: 'corona 0.5 Rs' },
      { ev: '−2 EV', shutter: '1/20', subject: 'corona 1.0 Rs' },
      { ev: 'BASE', shutter: '1/5', subject: 'frame edge', base: true },
      { ev: '+2 EV', shutter: '0.8"', subject: 'lunar disk' },
      { ev: '+4 EV', shutter: '3.2"', subject: 'earthshine' },
    ],
    notes:
      'Same 2 EV step as C2 — one press, five RAWs out to 3.2 seconds. C2 bottoms out at Q = −1; this carries the ladder four stops further, to Q = −5. Three attempts are scheduled inside totality; do not touch the rig while a burst runs.',
  },
  {
    id: 'c4',
    title: "Dial C4 — Diamond ring / Baily's beads",
    tagline: '2nd and 3rd contact',
    headline: 'ISO 200 · 1/2500 · ProCap SH2',
    notes:
      'Half-press to arm, full-press on the flash. Falls back to Sequential H, 10 fps, if ProCap balks at the MC-20.',
  },
]

export const FILTER_RULE =
  'FILTER ON for every second outside totality. OFF only between 2nd and 3rd contact.'
