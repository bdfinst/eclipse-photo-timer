import { MOUNT, POWER, TIMER, ZOOM_MARKS } from '../data/rigReference.js'

const SECTION_HEADING_CLASS =
  'font-display text-sm font-medium tracking-[0.15em] uppercase text-ink'

const TAGLINE_CLASS = 'mt-0.5 text-xs text-dim'

const NOTES_CLASS = 'px-3 py-2 text-xs leading-relaxed text-dim'

/**
 * The field card's rig page (src/data/rigReference.js), rendered in the
 * same instrument-card idiom as CameraSettingsReference: zoom marks,
 * timer program, mount, and power plan. Presentation only — every string
 * comes from the data module verbatim.
 */
function RigReference() {
  return (
    <div className="flex flex-col gap-4">
      <section className="border border-line/60 bg-void/40">
        <header className="border-b border-line/60 px-3 py-2">
          <h3 className={SECTION_HEADING_CLASS}>Zoom marks</h3>
          <p className={TAGLINE_CLASS}>{ZOOM_MARKS.tagline}</p>
        </header>
        {ZOOM_MARKS.marks.map((mark) => (
          <div key={mark.barrel} className="border-b border-line/60 px-3 py-2">
            <p className="font-mono text-xs font-semibold text-corona">
              {mark.barrel} — {mark.useFor}
            </p>
            <p className="mt-0.5 font-mono text-xs tabular-nums text-ink/90">
              {mark.trueFocal} true · {mark.ffEquiv} FF · {mark.coronaInFrame} in frame
            </p>
          </div>
        ))}
        <p className={NOTES_CLASS}>{ZOOM_MARKS.notes}</p>
      </section>

      <section className="border border-line/60 bg-void/40">
        <header className="border-b border-line/60 px-3 py-2">
          <h3 className={SECTION_HEADING_CLASS}>Timer</h3>
          <p className={TAGLINE_CLASS}>{TIMER.tagline}</p>
          <p className="mt-1 font-mono text-xs font-semibold text-corona">{TIMER.headline}</p>
        </header>
        <p className={NOTES_CLASS}>{TIMER.notes}</p>
      </section>

      <section className="border border-line/60 bg-void/40">
        <header className="border-b border-line/60 px-3 py-2">
          <h3 className={SECTION_HEADING_CLASS}>Mount</h3>
          <p className={TAGLINE_CLASS}>{MOUNT.tagline}</p>
        </header>
        <p className={NOTES_CLASS}>{MOUNT.notes}</p>
      </section>

      <section className="border border-line/60 bg-void/40">
        <header className="border-b border-line/60 px-3 py-2">
          <h3 className={SECTION_HEADING_CLASS}>Power</h3>
          <p className={TAGLINE_CLASS}>{POWER.tagline}</p>
        </header>
        <dl>
          {POWER.rows.map(({ label, value }) => (
            <div key={label} className="border-b border-line/60 px-3 py-2 last:border-0">
              <dt className="font-mono text-[0.65rem] tracking-[0.2em] uppercase text-corona/80">
                {label}
              </dt>
              <dd className="mt-0.5 text-xs leading-relaxed text-ink/80">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  )
}

export default RigReference
