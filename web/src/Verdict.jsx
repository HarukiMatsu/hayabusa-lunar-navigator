// Verdict: every check from checkMission() shown separately, with editable
// requirements and the cold numbers from thermalSummary().

import {DEFAULT_REQUIREMENTS} from './model.js'
import {checkRows} from './checks.js'

// Editable fields. Shares are typed as percentages and stored as 0 to 1.
const FIELDS = [
  {key: 'minSunShare', label: 'Min sunlit share', unit: '%', scale: 100, step: 5},
  {key: 'maxDarkHours', label: 'Max darkness', unit: 'hrs', scale: 1, step: 6},
  {key: 'minEarthShare', label: 'Min Earth in view', unit: '%', scale: 100, step: 5},
  {key: 'maxSlopeDeg', label: 'Max slope', unit: '°', scale: 1, step: 1},
  {key: 'minTempK', label: 'Min temperature', unit: 'K', scale: 1, step: 5},
  {key: 'maxTempK', label: 'Max temperature', unit: 'K', scale: 1, step: 5},
]

export default function Verdict({result, req, onReqChange, site}) {
  const rows = checkRows(result, req, site)
  const failed = rows.filter((r) => !result.checks[r.key]).length
  const t = result.thermal
  const setField = (f, text) => {
    const v = Number(text)
    if (text !== '' && Number.isFinite(v)) onReqChange({...req, [f.key]: v / f.scale})
  }
  return (
    <>
      <h3>{result.pass ? 'All checks pass' : `${failed} of ${rows.length} checks fail`}</h3>
      <ul className="check-list">
        {rows.map((r) => (
          <li key={r.key} className={result.checks[r.key] ? 'check-pass' : 'check-fail'}>
            <span className="check-mark" aria-hidden="true">{result.checks[r.key] ? '✓' : '✗'}</span>
            <span className="check-name">{r.name}</span>
            <span className="check-value">{r.value}</span>
            <span className="check-limit">{r.limit}</span>
            <span className="visually-hidden">{result.checks[r.key] ? 'pass' : 'fail'}</span>
          </li>
        ))}
      </ul>

      <div className="cold-report">
        <p>
          <strong>Cold (reported, not pass or fail).</strong>{' '}
          {t.hoursBeforeTooCold > 0
            ? `Without a heater the lander stays above ${req.minTempK} K for ${t.hoursBeforeTooCold.toFixed(0)} hrs after its warmest point.`
            : `The lander never warms above ${req.minTempK} K, so it needs heat from the start.`}{' '}
          Through the longest darkness ({t.longestDarkHours} hrs) a heater of {t.heaterPowerW.toFixed(0)} W
          needs {t.heaterEnergyWh.toFixed(0)} Wh from the battery.
        </p>
        <p className="panel-note">Lander thermal values (size, insulation, heat capacity) are placeholders, not a real design.</p>
      </div>

      <details className="requirements">
        <summary>Requirements (demo defaults, not NASA requirements)</summary>
        <div className="requirements-grid">
          {FIELDS.map((f) => (
            <label key={f.key}>
              <span>{f.label} ({f.unit})</span>
              <input type="number" step={f.step}
                value={Number((req[f.key] * f.scale).toFixed(2))}
                onChange={(event) => setField(f, event.target.value)} />
            </label>
          ))}
        </div>
        <button type="button" className="reset-button" onClick={() => onReqChange(DEFAULT_REQUIREMENTS)}>
          Reset to defaults
        </button>
      </details>
    </>
  )
}
