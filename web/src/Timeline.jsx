// Mission timeline: one bar per hour for sunlight and for Earth in view.
// Consecutive hours in the same state are drawn as one rectangle.

import {UP} from './model.js'

const SUN_COLOR = '#f2b84b'
const EARTH_COLOR = '#4ea3ff'

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

export default function Timeline({sunVis, earthVis, range, index, stepHours, onIndexChange}) {
  const W = 720, L = 92, R = 8, ROW = 26, GAP = 10, TOP = 6
  const H = TOP + 2 * ROW + GAP + 26
  const n = range.to - range.from
  const x = (i) => L + ((i - range.from) / n) * (W - L - R)
  const sunY = TOP, earthY = TOP + ROW + GAP

  const days = []
  const hoursPerDay = 24 / stepHours
  const dayStep = n / hoursPerDay > 16 ? 2 : 1
  for (let d = 0; d * hoursPerDay <= n; d += dayStep) days.push(d)

  const pick = (event) => {
    const box = event.currentTarget.getBoundingClientRect()
    const px = ((event.clientX - box.left) / box.width) * W
    if (px < L) return
    const i = range.from + Math.floor(((px - L) / (W - L - R)) * n)
    onIndexChange(Math.min(Math.max(i, range.from), range.to - 1))
  }

  return (
    <svg className="timeline-svg" viewBox={`0 0 ${W} ${H}`} onClick={pick} role="img"
      aria-label="Hourly sunlight and Earth visibility across the mission">
      <text x={L - 8} y={sunY + ROW / 2 + 4} textAnchor="end" className="sky-axis">Sunlight</text>
      <text x={L - 8} y={earthY + ROW / 2 + 4} textAnchor="end" className="sky-axis">Earth in view</text>
      <rect x={L} y={sunY} width={W - L - R} height={ROW} fill="#0b1423" />
      <rect x={L} y={earthY} width={W - L - R} height={ROW} fill="#0b1423" />
      {runs(sunVis, range.from, range.to, sunState).filter((r) => r.state !== 'none').map((r) => (
        <rect key={`s${r.start}`} x={x(r.start)} y={sunY} width={x(r.end) - x(r.start)} height={ROW}
          fill={SUN_COLOR} fillOpacity={r.state === 'full' ? 1 : 0.35} />
      ))}
      {runs(earthVis, range.from, range.to, earthState).filter((r) => r.state === 'up').map((r) => (
        <rect key={`e${r.start}`} x={x(r.start)} y={earthY} width={x(r.end) - x(r.start)} height={ROW}
          fill={EARTH_COLOR} />
      ))}
      {days.map((d) => (
        <g key={`d${d}`}>
          <line x1={x(range.from + d * hoursPerDay)} x2={x(range.from + d * hoursPerDay)}
            y1={sunY} y2={earthY + ROW + 4} stroke="#293d56" strokeWidth="0.75" />
          {(d + 1) * hoursPerDay <= n && (
            <text x={x(range.from + (d + 0.5) * hoursPerDay)} y={H - 6} textAnchor="middle" className="sky-axis">
              Day {d + 1}
            </text>
          )}
        </g>
      ))}
      <line x1={x(index + 0.5)} x2={x(index + 0.5)} y1={sunY - 3} y2={earthY + ROW + 3}
        stroke="#edf4ff" strokeWidth="1.5" />
    </svg>
  )
}
