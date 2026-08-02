/**
 * Rig reference — transcribed from the operator's field card
 * (Eclipse_2026_OM1_Field_Card_4.pdf, page 2, "RIG — LENS, TIMER, MOUNT,
 * POWER"), as amended by the fixed-focal change request
 * (eclipse-timer-CHANGE-fixed-focal.md): the zoom is locked at the 500
 * mark all day, so the 250 corona mark and the mid-totality zoom change
 * are gone. Remaining wording and numbers are the card's own — do not
 * reformat the values. Camera settings are src/data/cameraSettings.js (page 1); the
 * timeline (page 4) is the app's own live screen.
 */

export const ZOOM_MARKS = {
  tagline: 'TC is always on, so double the barrel',
  marks: [
    {
      barrel: '500',
      trueFocal: '1000mm',
      ffEquiv: '2000mm',
      coronaInFrame: '1.4 × 1.9 Rs',
      useFor: 'LOCKED all day — never changes',
    },
  ],
  notes:
    'Zoom to the 500 mark and tape it — it does not move again today. Friction collar to T. Rotate the body so the streamers run along the long axis.',
}

export const TIMER = {
  tagline: 'JJC TM-J2 · cable J2 into the 2.5mm remote port',
  headline: 'DELAY 0 · LONG 1″ · INTVL 4″ · N = 826',
  notes:
    'Run it twice: 16:47 (last frame 17:42) and 17:52 (last frame 18:47). 1652 frames = 55 s at 30 fps; add ~5 s of totality in the edit for a one-minute film. N = 826 makes it stop itself 4 min before C2 — never unlimited, or it fires black frames through totality. Drive must be Single: the timer holds the contact a full second, which on Sequential is a burst. If N caps below 826 → built-in Interval Shooting (Shooting 2 › Other Shooting Functions): Frames 826, Interval 00:00:04, Time Priority — but it cancels if you touch MENU, playback, the mode dial, the lens release, or plug in USB.',
}

export const MOUNT = {
  tagline: 'Star Adventurer GTi',
  notes:
    'Polar align before first contact. Solar tracking rate in SynScan. Balance at the 500 mark, camera-heavy so the RA drive stays loaded against one side of the backlash. Dec creeps ~1.5′ over two hours = 3% of frame height — leave it alone; recentring mid-run puts a jump in the time-lapse. Fallback if power fails: 8×AA lithium in the mount (9.0–12.6 V).',
}

// The card itself writes both "Sharge 170" (heading) and "Shargeek 170"
// (Mount row) for the same power bank — preserved as-is per the verbatim
// rule above; do not "fix" one to match the other.
export const POWER = {
  tagline: 'One Sharge 170 runs both · 86.4 Wh · ~7.5 W total · ~10 h of runtime',
  rows: [
    {
      label: 'Camera',
      value:
        'USB-C. Menu › USB Settings › USB PD. Plug in with the camera off, then power on and look for “USBP”. It negotiates 9 V or 15 V and needs a 27 W source; the bank gives 65 W per C port even with everything loaded. Not the USB-A port — that is QC, not PD. A charged BLX-1 must stay in the body, and it is your fallback.',
    },
    {
      label: 'Mount',
      value:
        'The other USB-C, through a 12 V PD trigger cable, 5.5 × 2.1 mm, centre positive. This works because the Shargeek 170 advertises a 12 V/3 A PDO — 12 V is optional in the PD spec and many banks omit it. Never feed it 15 V: the GTi is a 12 V device and its own battery range tops out at 12.6 V.',
    },
    {
      label: 'Then stop',
      value:
        'Once both are plugged in, do not touch any port. Adding or removing anything makes the bank re-run its power budget and can momentarily drop the other port. A GTi that reboots has lost its alignment. No topping up your phone off the spare port.',
    },
    {
      label: 'Card',
      value: '1652 RAWs ≈ 29 GB. 64 GB minimum, UHS-II, slot 1.',
    },
  ],
}
