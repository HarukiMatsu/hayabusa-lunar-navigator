// Mission timeline: one bar per hour for sunlight and for Earth in view.
// Each row is an SVG in hour units stretched to the full width, so the rows
// share the time axis of the slider above them at any screen width.
// Consecutive hours in the same state are drawn as one rectangle.

import {UP} from './model.js'

/** Runs of equal state between from and to: [{start, end, state}]. */
function runs(values, from, to, stateOf) {
  const out = []
  for (let i = from; i < to; i++) {
    const s = stateOf(values[i])
    const last = out[out.length - 1]
    if (last && last.state === s) last.end = i + 1
    else out.push({start: i, end: i + 1, state: s})
  }
  return out
}

// Sun: 'full' when at least half the disc is visible (counts as lit),
// 'partial' when some but less than half is visible, 'none' otherwise.
const sunState = (f) => (f >= UP ? 'full' : f > 0 ? 'partial' : 'none')
const earthState = (f) => (f >= UP ? 'up' : 'down')

function Row({label, track, children, n, cursor, onPick}) {
  return (
    <div className="tl-row">
      <span className="tl-label">{label}</span>
      <svg className={`tl-bar ${track}`} viewBox={`0 0 ${n} 1`} preserveAspectRatio="none"
        onClick={onPick} aria-hidden="true">
        {children}
        <line x1={cursor + 0.5} x2={cursor + 0.5} y1="0" y2="1" className="tl-cursor" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  )
}

export default function Timeline({sunVis, earthVis, range, index, stepHours, onIndexChange}) {
  const n = range.to - range.from
  const hoursPerDay = 24 / stepHours
  const days = Math.floor(n / hoursPerDay)
  const labelStep = days > 16 ? 2 : 1

  const pick = (event) => {
    const box = event.currentTarget.getBoundingClientRect()
    const i = range.from + Math.floor(((event.clientX - box.left) / box.width) * n)
    onIndexChange(Math.min(Math.max(i, range.from), range.to - 1))
  }
  const cursor = index - range.from

  return (
    <div className="timeline" role="img"
      aria-label={`Hour by hour sunlight and Earth visibility over ${days} days`}>
      <Row label="Sunlight" track="tl-track-sun" n={n} cursor={cursor} onPick={pick}>
        {runs(sunVis, range.from, range.to, sunState).filter((r) => r.state !== 'none').map((r) => (
          <rect key={r.start} x={r.start - range.from} y="0" width={r.end - r.start} height="1"
            className={r.state === 'full' ? 'tl-sun' : 'tl-sun-partial'} />
        ))}
      </Row>
      <Row label="Earth in view" track="tl-track-earth" n={n} cursor={cursor} onPick={pick}>
        {runs(earthVis, range.from, range.to, earthState).filter((r) => r.state === 'up').map((r) => (
          <rect key={r.start} x={r.start - range.from} y="0" width={r.end - r.start} height="1" className="tl-earth" />
        ))}
      </Row>
      <div className="tl-days" aria-hidden="true">
        {Array.from({length: days}, (_, d) => d).filter((d) => d % labelStep === 0).map((d) => (
          <span key={d} className={[(d / labelStep) % 2 === 0 ? 'm2' : '', (d / labelStep) % 4 === 0 ? 'm4' : ''].join(' ').trim() || undefined}
            style={{left: `${((d + 0.5) * hoursPerDay * 100) / n}%`}}>Day {d + 1}</span>
        ))}
      </div>
    </div>
  )
}
