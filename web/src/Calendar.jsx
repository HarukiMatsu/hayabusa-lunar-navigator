// Landing calendar: does a mission starting on each day of the data pass every check?
// One row per month, one cell per day. Click a day to land then.
// A passing day is a tall bar and a failing day a short bar, so the result
// reads without colour; the text for each day names the failing checks.
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
        <span className="numeral">{(100 * calendar.availability).toFixed(0)}%</span>
        <span>of landing days pass ({passing} of {calendar.days.length}) for a {missionDays}-day mission.</span>
      </p>
      <div className="calendar" aria-label={`Landing days in ${year}`}>
        {MONTHS.map((name, m) => {
          const daysInMonth = new Date(Date.UTC(year, m + 1, 0)).getUTCDate()
          return (
            <div className="calendar-row" key={name}>
              <span className="calendar-month">{name}</span>
              {Array.from({length: 31}, (_, i) => {
                if (i >= daysInMonth) return <span key={i} className="calendar-cell" />
                const date = `${year}-${String(m + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`
                const day = byDate.get(date)
                const failed = day ? Object.keys(day.checks).filter((k) => !day.checks[k]) : []
                const state = !day ? 'nodata' : day.pass ? 'pass' : 'fail'
                const label = !day
                  ? `${date}: mission would run past the end of the data`
                  : day.pass ? `${date}: pass, every check` : `${date}: fail, ${failed.map((k) => NAMES[k]).join(', ')}`
                return (
                  <button key={i} type="button" title={label} aria-label={label}
                    aria-pressed={date === selectedDay}
                    className={`calendar-cell ${state}${date === selectedDay ? ' selected' : ''}`}
                    disabled={!day} onClick={() => onPick(date)}>
                    <span className="calendar-bar" />
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
      <p className="legend">
        <span className="key key-pass" aria-hidden="true" /> Tall bar: pass.{' '}
        <span className="key key-fail" aria-hidden="true" /> Short bar: fail.{' '}
        Empty: the mission would run past the end of the data. Hover a day for the failing checks; select a day to land then.
      </p>
    </>
  )
}
