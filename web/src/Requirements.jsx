// Editable requirements for checkMission(). Shares are typed as percentages
// and stored as 0 to 1, as model.js expects.

import {DEFAULT_REQUIREMENTS} from './model.js'

const FIELDS = [
  {key: 'minSunShare', label: 'Minimum sunlit share', unit: '%', scale: 100, step: 5},
  {key: 'maxDarkHours', label: 'Maximum darkness', unit: 'h', scale: 1, step: 6},
  {key: 'minEarthShare', label: 'Minimum Earth in view', unit: '%', scale: 100, step: 5},
  {key: 'maxSlopeDeg', label: 'Maximum slope', unit: '°', scale: 1, step: 1},
  {key: 'minTempK', label: 'Minimum temperature', unit: 'K', scale: 1, step: 5},
  {key: 'maxTempK', label: 'Maximum temperature', unit: 'K', scale: 1, step: 5},
]

export default function Requirements({req, onChange}) {
  const setField = (f, text) => {
    const v = Number(text)
    if (text !== '' && Number.isFinite(v)) onChange({...req, [f.key]: v / f.scale})
  }
  return (
    <fieldset className="requirements">
      <legend>Requirements</legend>
      <p className="note">Demo defaults, not NASA requirements.</p>
      {FIELDS.map((f) => (
        <label key={f.key} className="field">
          <span>{f.label} ({f.unit})</span>
          <input type="number" step={f.step}
            value={Number((req[f.key] * f.scale).toFixed(2))}
            onChange={(event) => setField(f, event.target.value)} />
        </label>
      ))}
      <button type="button" className="text-button" onClick={() => onChange(DEFAULT_REQUIREMENTS)}>
        Reset to defaults
      </button>
    </fieldset>
  )
}
