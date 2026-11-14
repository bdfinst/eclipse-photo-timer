/**
 * Prep checklist groups — item text transcribed from eclipse-timer-spec.md
 * §5.2 (markdown emphasis/code-span markers stripped), as amended by the
 * operator's change requests, most recently the updated timelapse
 * requirements of 2026-08-12: no teleconverter, 600mm native, f/8 fixed,
 * C1 at ISO 100 with the shutter pinned by an on-site test series, 5-frame
 * HDR sets on C2/C3, and the ~7.2 s timer program (INTVL 7s, N = 472).
 * Item `id`s are this file's own addition — the spec has no ids — used as
 * the persistence key under `eclipse.checklist`.
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
      { id: 'night-power-bank', text: 'Charge Sharge power bank' },
      { id: 'night-card', text: 'Format a 64 GB+ UHS-II card, in slot 1' },
      { id: 'night-procap', text: 'Confirm ProCap SH2 works with the 150-600 (no TC mounted)' },
      {
        id: 'night-meter',
        text: 'Meter the solar filter: ~1/1000–1/2000 at ISO 100, f/8 expected — final value on site',
      },
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
        text: 'C1 — M, f/8, ISO 100, ~1/1000, Single drive, silent, RAW, WB 5400K',
      },
      {
        id: 'camera-c2',
        text: 'C2 — M, f/8, ISO 1600, base 1/8, HDR 5f 2.0EV',
      },
      {
        id: 'camera-c3',
        text: 'C3 — M, f/8, ISO 200, base 1/60, HDR 5f 2.0EV',
      },
      { id: 'camera-c4', text: 'C4 — M, f/8, ISO 200, 1/2500, ProCap SH2' },
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
      { id: 'site-balance', text: 'Balanced at the 600 stop, slightly camera-heavy' },
      {
        id: 'site-zoom-taped',
        text: 'Zoom set to the 600 stop and taped — it does not move again today',
      },
      { id: 'site-friction-collar', text: 'Zoom friction collar set to T' },
      {
        id: 'site-filter-taped',
        text: 'Solar filter on the front, taped against the wind',
      },
      {
        id: 'site-usb-power',
        text: 'USB PD connected with the camera off, USBP confirmed on power-up',
      },
      {
        id: 'site-test-series',
        text: 'Test exposure series through the filter — pin the C1 shutter (1/1000–1/2000 expected) against the histogram',
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
        text: 'Timer programmed: DELAY 0, LONG 1s, INTVL 7s, N = 472',
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

/**
 * Per-group completion derived from a persisted `checked` map
 * ({ [itemId]: boolean }, the `eclipse.checklist` shape). Ids not belonging
 * to a group are simply never counted, so stale keys from removed items
 * can't inflate a percentage. Pure — reads only CHECKLIST_GROUPS and the
 * argument — so the PrepScreen home view can recompute it every tick
 * without touching storage itself.
 *
 * @param {Record<string, boolean>} checked
 * @returns {{ id: string, title: string, done: number, total: number, percent: number }[]}
 */
export function checklistProgress(checked) {
  return CHECKLIST_GROUPS.map((group) => {
    const total = group.items.length
    const done = group.items.filter((item) => Boolean(checked?.[item.id])).length

    return {
      id: group.id,
      title: group.title,
      done,
      total,
      percent: total === 0 ? 0 : Math.round((done / total) * 100),
    }
  })
}
