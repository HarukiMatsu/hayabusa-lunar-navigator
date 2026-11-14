// Landing calendar: does a mission starting on each day of the data pass every check?
// One row per month, one cell per day. Click a day to land then.
// landingCalendar() runs a year of checks (about 4 ms for a 14-day mission in
// Node); it is cached so the sky view animation does not recompute it each frame.

import {useMemo} from 'react'
import {DEFAULT_LANDER, landingCalendar} from './model.js'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const NAMES = {sunlight: 'sunlight', power: 'darkness', comms: 'Earth', slope: 'slope', notTooHot: 'too hot'}

export default function Calendar({meta, site, requirements, mast, year, selectedDay, onPick, missionDays}) {
  const calendar = useMemo(
    () => landingCalendar(meta, site, missionDays, requirements, DEFAULT_LANDER, mast),
    [meta, site, missionDays, requirements, mast],
  )
  const byDate = new Map(calendar.days.map((d) => [d.date, d]))
  const passing = calendar.days.filter((d) => d.pass).length
  return (
    <>
      <p className="calendar-headline">
        <strong>{(100 * calendar.availability).toFixed(0)}%</strong> of landing days pass
        ({passing} of {calendar.days.length}) for a {missionDays}-day mission.
      </p>
      <div className="calendar-grid" role="grid" aria-label={`Landing days in ${year}`}>
        {MONTHS.map((name, m) => {
          const daysInMonth = new Date(Date.UTC(year, m + 1, 0)).getUTCDate()
          return (
            <div className="calendar-row" role="row" key={name}>
              <span className="calendar-month" role="rowheader">{name}</span>
              {Array.from({length: 31}, (_, i) => {
                if (i >= daysInMonth) return <span key={i} className="calendar-cell empty" />
                const date = `${year}-${String(m + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`
                const day = byDate.get(date)
                const failed = day ? Object.keys(day.checks).filter((k) => !day.checks[k]) : []
                const state = !day ? 'nodata' : day.pass ? 'pass' : 'fail'
                const label = !day
                  ? `${date}: mission would run past the end of the data`
                  : day.pass ? `${date}: passes every check` : `${date}: fails ${failed.map((k) => NAMES[k]).join(', ')}`
                return (
                  <button key={i} type="button" role="gridcell" title={label} aria-label={label}
                    className={`calendar-cell ${state}${date === selectedDay ? ' selected' : ''}`}
                    disabled={!day} onClick={() => onPick(date)} />
                )
              })}
            </div>
          )
        })}
      </div>
      <div className="sky-legend">
        <span className="legend-pass">Passes every check</span>
        <span className="legend-fail">Fails at least one</span>
        <span className="legend-nodata">Mission would run past the data</span>
        <span>Hover a day for the failing checks; click to land then</span>
      </div>
    </>
  )
}
