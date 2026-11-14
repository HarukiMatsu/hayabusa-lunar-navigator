// Countdown to the next change in sunlight and Earth contact from the selected hour.

import {hoursUntilChange, UP} from './model.js'

const HOUR_MS = 3600000

function Card({title, upWord, downWord, setWord, riseWord, values, index, range, stepHours, startMs}) {
  const up = values[index] >= UP
  const change = hoursUntilChange(values, index, stepHours)
  let detail = 'No change before the end of the data (end of 2027)'
  if (change) {
    const when = new Date(startMs + (index * stepHours + change.hours) * HOUR_MS)
    const afterEnd = index + change.hours / stepHours >= range.to
    detail = `${change.event === 'set' ? setWord : riseWord} at ${when.toISOString().slice(0, 16).replace('T', ' ')} UTC`
      + (afterEnd ? ', after the mission ends' : '')
  }
  return (
    <div className="metric-card">
      <p>{title}</p>
      <h3>{change ? `${change.hours} hrs` : '--'}</h3>
      <span>{up ? upWord : downWord} now. {detail}</span>
    </div>
  )
}

export default function Countdown({site, mast, index, range, stepHours, startMs}) {
  const sunVis = mast === '5m' ? site.sun_5m : site.sun
  const earthVis = mast === '5m' ? site.earth_5m : site.earth
  const common = {index, range, stepHours, startMs}
  return (
    <div className="metrics-grid countdown-grid">
      <Card title={sunVis[index] >= UP ? 'Time to Sunset' : 'Time to Sunrise'}
        upWord="Sun in view" downWord="Sun hidden" setWord="Sets" riseWord="Rises"
        values={sunVis} {...common} />
      <Card title={earthVis[index] >= UP ? 'Time to Earthset' : 'Time to Earthrise'}
        upWord="Earth in view" downWord="Earth hidden" setWord="Sets" riseWord="Rises"
        values={earthVis} {...common} />
    </div>
  )
}
