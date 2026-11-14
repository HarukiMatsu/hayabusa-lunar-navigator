// Compare: up to four saved scenarios side by side, each run through checkMission().

import {checkMission, DEFAULT_LANDER, missionRange} from './model.js'
import {checkRows} from './checks.js'


export default function Compare({data, scenarios, req, max, onRemove}) {
  if (!scenarios.length) {
    return <p className="panel-note">Choose a site, landing time, mission length and mast, then click + Compare to add them here (up to {max}).</p>
  }
  return (
    <div className="scenario-grid">
      {scenarios.map((sc) => {
        const site = data.sites.find((s) => s.id === sc.siteId)
        const range = missionRange(data.meta, sc.landingIso, sc.missionDays)
        const result = checkMission(site, range, req, DEFAULT_LANDER, data.meta.step_hours, sc.mast)
        return (
          <article key={sc.key} className="scenario-card">
            <div className="section-heading">
              <h3>{site.name}</h3>
              <span className={`verdict-status ${result.pass ? 'status-pass' : 'status-fail'}`}>
                {result.pass ? 'Pass' : 'Fail'}
              </span>
            </div>
            <p className="scenario-meta">
              Landing {sc.landingIso.slice(0, 16).replace('T', ' ')} UTC, {sc.missionDays} {sc.missionDays === 1 ? 'day' : 'days'}, {sc.mast === '5m' ? '5 m' : '1 m'} mast
            </p>
            <ul className="check-list">
              {checkRows(result, req, site).map((r) => (
                <li key={r.key} className={result.checks[r.key] ? 'check-pass' : 'check-fail'}>
                  <span className="check-mark" aria-hidden="true">{result.checks[r.key] ? '✓' : '✗'}</span>
                  <span className="check-name">{r.name}</span>
                  <span className="check-value">{r.value}</span>
                  <span className="visually-hidden">{result.checks[r.key] ? 'pass' : 'fail'}</span>
                </li>
              ))}
            </ul>
            <button type="button" className="reset-button" onClick={() => onRemove(sc.key)}>Remove</button>
          </article>
        )
      })}
    </div>
  )
}
