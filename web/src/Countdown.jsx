// Countdown to the next change in sunlight and Earth contact from the selected hour,
// from hoursUntilChange() in model.js.

import {hoursUntilChange, UP} from './model.js'

const HOUR_MS = 3600000

function Line({body, values, index, range, stepHours, startMs}) {
  const up = values[index] >= UP
  const change = hoursUntilChange(values, index, stepHours)
  let next = 'No change before the end of the data (end of 2027).'
  if (change) {
    const when = new Date(startMs + (index * stepHours + change.hours) * HOUR_MS)
    const afterEnd = index + change.hours / stepHours >= range.to
    next = `${change.event === 'set' ? 'Sets' : 'Rises'} in ${change.hours} h, at ${when.toISOString().slice(0, 16).replace('T', ' ')} UTC`
      + (afterEnd ? ', after the mission ends.' : '.')
  }
  return (
    <p className={`now-line now-${body.toLowerCase()}`}>
      <strong>{body} {up ? 'in view' : 'hidden'}.</strong> {next}
    </p>
  )
}

export default function Countdown({site, mast, index, range, stepHours, startMs}) {
  const sunVis = mast === '5m' ? site.sun_5m : site.sun
  const earthVis = mast === '5m' ? site.earth_5m : site.earth
  const common = {index, range, stepHours, startMs}
  return (
    <div className="countdown">
      <Line body="Sun" values={sunVis} {...common} />
      <Line body="Earth" values={earthVis} {...common} />
    </div>
  )
}
