/**
 * Camera-settings reference — transcribed from the operator's field card
 * (Eclipse_2026_OM1_Field_Card_4.pdf, page 1, "CAMERA SETTINGS"), as
 * amended by the operator's change requests, most recently the updated
 * timelapse requirements of 2026-08-12 ("Eclipse Timelapse Requirements —
 * Updated"): the MC-20 teleconverter is gone, the lens shoots native at
 * 600mm, and every mode is fixed at f/8 — shutter and ISO carry the
 * bracket range, never the aperture. C2 is now the earthshine/outer-corona
 * set and C3 the prominence/inner-corona set, both 5-frame HDR ladders.
 * Numbers are the change requests' own — do not recompute them. C1's
 * shutter is nominal (~1/1000): the requirements pin it to an on-site
 * test series against the actual filter density (1/1000–1/2000 expected).
 * The exposure ladder DERIVATIONS and rig/power notes (page 2) are
 * deliberately not included here — this is the in-field settings
 * reference, not the planning document.
 */

export const RIG_SUMMARY = 'OM-1 · 150-600, no TC · LOCKED at 600mm, f/8 · SafeSight ND 5.0'

/** @type {{ label: string, value: string }[]} */
export const GLOBAL_SETTINGS = [
  { label: 'Mode', value: 'M, always' },
  { label: 'Aperture', value: 'f/8, every mode. Never vary it mid-sequence.' },
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
    headline: 'ISO 100 · ~1/1000 · Single drive',
    notes:
      '1/1000 is the nominal — the on-site test series against the filter sets the real value; anywhere in 1/1000–1/2000 is expected. Expose off the RGB histogram, not luminance. Ramp +⅔ stop at the 17:42 handover and +1 stop at T−60s — by then only the limb is left and it averages 0.83 stops below the full disk. Mirror after C3. Turn the dial slowly and let it settle 5 s before the next frame. Stay in M — A mode meters the black moon once the crescent thins and runs away.',
  },
  {
    id: 'c2',
    title: 'Dial C2 — Earthshine & outer corona',
    tagline: 'filter off · picks up where dial C3 stops · three windows inside totality',
    headline: 'ISO 1600 · base 1/8 · Menu › Shooting 2 › HDR › 5f 2.0EV',
    ladder: [
      { ev: '−4 EV', shutter: '1/125', subject: 'corona 1.0 Rs' },
      { ev: '−2 EV', shutter: '1/30', subject: 'corona 2.0 Rs' },
      { ev: 'BASE', shutter: '1/8', subject: 'frame edge', base: true },
      { ev: '+2 EV', shutter: '0.5"', subject: 'lunar disk' },
      { ev: '+4 EV', shutter: '2"', subject: 'earthshine' },
    ],
    notes:
      'One press, five RAWs out to 2 seconds. Not HDR1/HDR2 — those merge to JPEG and lock ISO. If the on-site series says the slow frames need more, go to ISO 3200 — shutter and ISO carry the range, never the aperture. Do not touch the rig while a set runs. At 600mm the frame tops out at 2.3 Rs vertically — the 2-second frame is earthshine, not more streamer.',
  },
  {
    id: 'c3',
    title: 'Dial C3 — Prominences & inner corona',
    tagline: 'filter off · first and last presses of totality',
    headline: 'ISO 200 · base 1/60 · Menu › Shooting 2 › HDR › 5f 2.0EV',
    ladder: [
      { ev: '−4 EV', shutter: '1/1000', subject: 'chromosphere' },
      { ev: '−2 EV', shutter: '1/250', subject: 'prominences' },
      { ev: 'BASE', shutter: '1/60', subject: 'corona 0.1 Rs', base: true },
      { ev: '+2 EV', shutter: '1/15', subject: 'corona 0.2 Rs' },
      { ev: '+4 EV', shutter: '1/4', subject: 'corona 0.5 Rs' },
    ],
    notes:
      'One press, five RAWs, well under two seconds. The 1/1000 and 1/250 frames are the prominence money shots — the range the requirements call ~1/500–1/1000 at f/8. The slow end reaches 0.5 Rs, where dial C2’s ladder picks up, so the two sets splice into one HDR curve.',
  },
  {
    id: 'c4',
    title: "Dial C4 — Diamond ring / Baily's beads",
    tagline: '2nd and 3rd contact',
    headline: 'ISO 200 · 1/2500 · ProCap SH2',
    notes:
      'Half-press to arm, full-press on the flash. Falls back to Sequential H, 10 fps, if ProCap balks.',
  },
]

export const FILTER_RULE =
  'FILTER ON for every second outside totality. OFF only between 2nd and 3rd contact.'
