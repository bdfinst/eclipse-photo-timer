/**
 * Prep checklist groups — item text transcribed verbatim from
 * eclipse-timer-spec.md §5.2 (markdown emphasis/code-span markers stripped;
 * the wording itself is unchanged). Item `id`s are this file's own addition —
 * the spec has no ids — used as the persistence key under `eclipse.checklist`.
 *
 * @typedef {Object} ChecklistItem
 * @property {string} id
 * @property {string} text
 *
 * @typedef {Object} ChecklistGroup
 * @property {string} id
 * @property {string} title
 * @property {ChecklistItem[]} items
 */

import { removeItem } from '../services/storage.js'

export const CHECKLIST_STORAGE_KEY = 'eclipse.checklist'

export function resetChecklist() {
  removeItem(CHECKLIST_STORAGE_KEY)
}

/** @type {ChecklistGroup[]} */
export const CHECKLIST_GROUPS = [
  {
    id: 'night-before',
    title: 'The night before',
    items: [
      { id: 'night-battery', text: 'Charge camera battery + two spares' },
      { id: 'night-power-bank', text: 'Charge the ≥27 W USB-C PD power bank' },
      { id: 'night-card', text: 'Format a 64 GB+ UHS-II card, in slot 1' },
      {
        id: 'night-hdr-bracket',
        text: 'Confirm HDR bracket 7f 2.0EV fires seven RAWs including the 1.3 s frame',
      },
      { id: 'night-procap', text: 'Confirm ProCap SH2 works with the MC-20 attached' },
      {
        id: 'night-jjc',
        text: 'Confirm the JJC will accept N = 826 (if not, use built-in Interval Shooting)',
      },
      {
        id: 'night-meter',
        text: 'Meter the solar filter: 1/400 at ISO 200, f/11 should be correct',
      },
      {
        id: 'night-parfocality',
        text: 'Check parfocality: focus at zoom 500, pull to 250, inspect at 14×',
      },
      { id: 'night-zoom-mark', text: 'Tape a mark on the zoom barrel at 250' },
      {
        id: 'night-clock-offset',
        text: 'Set the clock offset in this app while you still have signal',
      },
    ],
  },
  {
    id: 'camera-setup',
    title: 'Camera setup',
    items: [
      {
        id: 'camera-c1',
        text: 'C1 — M, wide open, ISO 200, 1/400, Single, silent, RAW, WB 5400K',
      },
      {
        id: 'camera-c2',
        text: 'C2 — M, wide open, ISO 200, base 1/50, HDR 7f 2.0EV, silent, RAW',
      },
      {
        id: 'camera-c3',
        text: 'C3 — M, wide open, ISO 1600, manual sweep 1.3 / 2.5 / 5 s',
      },
      { id: 'camera-c4', text: 'C4 — M, wide open, ISO 200, 1/2500, ProCap SH2' },
      { id: 'camera-iso', text: 'ISO is not Auto' },
      { id: 'camera-sleep', text: 'Sleep / auto power-off OFF' },
      { id: 'camera-rec-view', text: 'Rec View OFF' },
      { id: 'camera-is', text: 'IS OFF — body switch and lens switch' },
      {
        id: 'camera-subject-detection',
        text: 'Subject detection OFF, long-exposure NR OFF',
      },
      { id: 'camera-mode-retention', text: 'Custom mode retention: Reset' },
      { id: 'camera-af', text: 'AF set to MF' },
    ],
  },
  {
    id: 'site',
    title: 'At the site (T-60 min)',
    items: [
      {
        id: 'site-polar-align',
        text: 'Tripod level, GTi polar aligned, solar tracking rate selected',
      },
      { id: 'site-balance', text: 'Balanced at the 250 zoom mark, slightly camera-heavy' },
      { id: 'site-friction-collar', text: 'Zoom friction collar set to T' },
      {
        id: 'site-filter-taped',
        text: 'Solar filter on the front, taped against the wind',
      },
      {
        id: 'site-usb-power',
        text: 'USB PD connected with the camera off, USBP confirmed on power-up',
      },
    ],
  },
  {
    id: 't15',
    title: 'T-15 min',
    items: [
      { id: 't15-focus', text: 'Focus locked and taped' },
      {
        id: 't15-timer',
        text: 'Timer programmed: DELAY 0, LONG 1s, INTVL 4s, N = 826',
      },
      { id: 't15-dry-run', text: 'Dry-run burst fired and reviewed' },
      {
        id: 't15-phone',
        text: 'Phone on this app, screen wake lock active, audio unlocked',
      },
      {
        id: 't15-glasses',
        text: 'Eclipse glasses in a pocket you can reach with gloves on',
      },
    ],
  },
]
