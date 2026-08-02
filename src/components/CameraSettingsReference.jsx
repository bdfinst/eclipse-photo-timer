import { CUSTOM_MODES, FILTER_RULE, GLOBAL_SETTINGS, RIG_SUMMARY } from '../data/cameraSettings.js'

const MICRO_LABEL_CLASS = 'font-mono text-[0.65rem] tracking-[0.3em] uppercase text-dim'

/**
 * The field card's camera-settings page (src/data/cameraSettings.js),
 * rendered as instrument panels: the set-once global table, one card per
 * custom dial mode with its HDR ladder, and the filter rule as a
 * can't-miss warning strip. Presentation only — every string comes from
 * the data module verbatim.
 */
function CameraSettingsReference() {
  return (
    <div className="flex flex-col gap-4">
      <p className="font-mono text-xs leading-relaxed text-corona/80">{RIG_SUMMARY}</p>

      <section>
        <h3 className={`mb-1 ${MICRO_LABEL_CLASS}`}>Global — set once</h3>
        <dl>
          {GLOBAL_SETTINGS.map(({ label, value }) => (
            <div
              key={label}
              className="flex items-baseline justify-between gap-3 border-b border-line/60 py-1.5 last:border-0"
            >
              <dt className="shrink-0 text-xs text-dim">{label}</dt>
              <dd className="text-right font-mono text-xs text-ink/90">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {CUSTOM_MODES.map((mode) => (
        <section key={mode.id} className="border border-line/60 bg-void/40">
          <header className="border-b border-line/60 px-3 py-2">
            <h3 className="font-display text-sm font-medium tracking-[0.15em] uppercase text-ink">
              {mode.title}
            </h3>
            <p className="mt-0.5 text-xs text-dim">{mode.tagline}</p>
            <p className="mt-1 font-mono text-xs font-semibold text-corona">{mode.headline}</p>
          </header>

          {mode.ladder && (
            <table className="w-full border-b border-line/60 font-mono text-xs tabular-nums">
              <caption className="sr-only">{`${mode.title} HDR bracket ladder`}</caption>
              <thead className="sr-only">
                <tr>
                  <th scope="col">Exposure step</th>
                  <th scope="col">Shutter</th>
                  <th scope="col">Subject</th>
                </tr>
              </thead>
              <tbody>
                {mode.ladder.map((step) => (
                  <tr
                    key={step.ev}
                    /* The base frame is marked by the BASE text label AND
                       weight, not color alone. */
                    className={step.base ? 'font-semibold text-corona' : 'text-ink/90'}
                  >
                    <td className={`w-14 py-0.5 pl-3 ${step.base ? '' : 'text-dim'}`}>{step.ev}</td>
                    <td className="w-16 py-0.5 font-semibold">{step.shutter}</td>
                    <td className={`py-0.5 pr-3 ${step.base ? '' : 'text-dim'}`}>{step.subject}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <p className="px-3 py-2 text-xs leading-relaxed text-dim">{mode.notes}</p>
        </section>
      ))}

      <p className="border border-corona bg-corona/10 px-3 py-2 text-center font-mono text-xs font-semibold tracking-wide text-corona">
        {FILTER_RULE}
      </p>
    </div>
  )
}

export default CameraSettingsReference
