// Verdict: every check from checkMission() shown separately as a checklist,
// with the cold numbers from thermalSummary(). Pass and fail are written as
// words, so the result does not depend on colour.

import {checkRows} from './checks.js'

export default function Verdict({result, req, site}) {
  const rows = checkRows(result, req, site)
  const failed = rows.filter((r) => !result.checks[r.key]).length
  const t = result.thermal
  return (
    <section className="verdict" aria-labelledby="verdict-title">
      <h2 id="verdict-title">
        Verdict: <span className={result.pass ? 'word-pass' : 'word-fail'}>{result.pass ? 'pass' : 'fail'}</span>
        <span className="verdict-count">
          {result.pass ? `All ${rows.length} checks pass` : `${failed} of ${rows.length} checks fail`}
        </span>
      </h2>
      <ul className="checklist">
        {rows.map((r) => (
          <li key={r.key}>
            <span className={result.checks[r.key] ? 'word-pass' : 'word-fail'}>
              {result.checks[r.key] ? 'Pass' : 'Fail'}
            </span>
            <span className="check-name">{r.name}</span>
            <span className="check-value">{r.value}</span>
            <span className="check-limit">needs {r.limit}</span>
          </li>
        ))}
      </ul>
      <p className="cold-report">
        <strong>Cold is reported, not passed or failed.</strong>{' '}
        {t.hoursBeforeTooCold > 0
          ? `Without a heater the lander stays above ${req.minTempK} K for ${t.hoursBeforeTooCold.toFixed(0)} h after its warmest point.`
          : `The lander never warms above ${req.minTempK} K, so it needs heat from the start.`}{' '}
        Through the longest darkness ({t.longestDarkHours} h) a {t.heaterPowerW.toFixed(0)} W heater
        needs {t.heaterEnergyWh.toFixed(0)} Wh from the battery.
      </p>
      <p className="note">Lander thermal values (size, insulation, heat capacity) are placeholders, not a real design.</p>
    </section>
  )
}
