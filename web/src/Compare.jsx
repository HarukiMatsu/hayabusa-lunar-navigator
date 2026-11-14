// Compare: up to four saved scenarios side by side, each run through checkMission().
// Pass and fail are written as words.

import {checkMission, DEFAULT_LANDER, missionRange} from './model.js'
import {checkRows} from './checks.js'

export default function Compare({data, scenarios, req, max, onRemove}) {
  if (!scenarios.length) {
    return <p className="note">Choose a site, landing time, mission length and mast, then press Add to comparison (up to {max}).</p>
  }
  return (
    <div className="scenarios">
      {scenarios.map((sc) => {
        const site = data.sites.find((s) => s.id === sc.siteId)
        const range = missionRange(data.meta, sc.landingIso, sc.missionDays)
        const result = checkMission(site, range, req, DEFAULT_LANDER, data.meta.step_hours, sc.mast)
        return (
          <article key={sc.key} className="scenario">
            <h3>{site.name}</h3>
            <p className="note">
              {sc.landingIso.slice(0, 16).replace('T', ' ')} UTC, {sc.missionDays} {sc.missionDays === 1 ? 'day' : 'days'}, {sc.mast === '5m' ? '5 m' : '1 m'} mast
            </p>
            <p className="scenario-result">
              <span className={result.pass ? 'word-pass' : 'word-fail'}>{result.pass ? 'Pass' : 'Fail'}</span>
            </p>
            <ul className="checklist compact">
              {checkRows(result, req, site).map((r) => (
                <li key={r.key}>
                  <span className={result.checks[r.key] ? 'word-pass' : 'word-fail'}>
                    {result.checks[r.key] ? 'Pass' : 'Fail'}
                  </span>
                  <span className="check-name">{r.name}</span>
                  <span className="check-value">{r.value}</span>
                </li>
              ))}
            </ul>
            <button type="button" className="text-button" onClick={() => onRemove(sc.key)}>
              Remove<span className="visually-hidden"> {site.name}</span>
            </button>
          </article>
        )
      })}
    </div>
  )
}
