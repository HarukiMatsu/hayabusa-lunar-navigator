// Sky view: the terrain horizon around the site with the Sun and Earth.
// Panorama: all 360 degrees of azimuth, stretched vertically so a few degrees
// of elevation are readable; Sun and Earth are markers, not to scale.
// Close-ups: 8 x 5 degree windows at equal scale, so each disc and the
// horizon behind it are drawn at their true angular sizes.

// Mean angular radii. The Sun varies by about 1% over the year, Earth by about 7%.
export const SUN_RADIUS_DEG = 0.27
export const EARTH_RADIUS_DEG = 0.95

const SUN_COLOR = '#f2b84b'
const EARTH_COLOR = '#4ea3ff'
const HORIZON_COLOR = '#91a9c7'

/** Horizon height at any azimuth, linear between the 0.5 degree samples. */
function horizonAt(horizon, az) {
  const n = horizon.length
  const p = (((az % 360) + 360) % 360) / (360 / n)
  const i = Math.floor(p) % n
  const f = p - Math.floor(p)
  return (1 - f) * horizon[i] + f * horizon[(i + 1) % n]
}

/** Circular mean of azimuths in degrees. */
function meanAzimuth(values, from, to) {
  let x = 0, y = 0
  for (let i = from; i < to; i++) {
    x += Math.cos((values[i] * Math.PI) / 180)
    y += Math.sin((values[i] * Math.PI) / 180)
  }
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

const compass = {0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW'}

function Panorama({site, horizon, range, index, sunUp, earthUp}) {
  const W = 720, H = 280, L = 40, R = 10, T = 12, B = 24
  // Centre the view on Earth's mean direction so Earth never wraps at the edge.
  const centre = Math.round(meanAzimuth(site.earth_az, range.from, range.to) / 10) * 10
  const rel = (az) => ((az - centre + 540) % 360) - 180      // -180 .. 180
  const x = (az) => L + ((rel(az) + 180) / 360) * (W - L - R)

  let lo = Math.min(...horizon), hi = Math.max(...horizon)
  for (let i = range.from; i < range.to; i++) {
    lo = Math.min(lo, site.sun_el[i], site.earth_el[i])
    hi = Math.max(hi, site.sun_el[i], site.earth_el[i])
  }
  lo = Math.floor(lo - 0.5)
  hi = Math.ceil(hi + 1)
  const y = (el) => T + ((hi - el) / (hi - lo)) * (H - T - B)
  const pxPerDegX = (W - L - R) / 360
  const pxPerDegY = (H - T - B) / (hi - lo)

  // Ground: horizon samples ordered left to right, closed along the bottom.
  const pts = horizon.map((h, k) => [rel(k * 0.5), h]).sort((a, b) => a[0] - b[0])
  const first = pts[0]
  const ground = [
    `${L},${H - B}`,
    `${L},${y(first[1])}`,
    ...pts.map(([r, h]) => `${L + ((r + 180) / 360) * (W - L - R)},${y(h)}`),
    `${W - R},${y(first[1])}`,
    `${W - R},${H - B}`,
  ].join(' ')

  // Paths over the mission window, broken where they wrap past the edge.
  const track = (azs, els) => {
    const segs = []
    let cur = []
    for (let i = range.from; i < range.to; i++) {
      if (cur.length && Math.abs(rel(azs[i]) - rel(azs[i - 1])) > 180) {
        segs.push(cur)
        cur = []
      }
      cur.push(`${x(azs[i]).toFixed(1)},${y(els[i]).toFixed(1)}`)
    }
    if (cur.length) segs.push(cur)
    return segs.map((s) => s.join(' '))
  }

  const ticks = []
  for (let a = 0; a < 360; a += 45) ticks.push(a)
  const elTicks = []
  for (let e = Math.ceil(lo); e <= hi; e += (hi - lo > 10 ? 2 : 1)) elTicks.push(e)

  return (
    <svg className="sky-svg" viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label="Panorama of the terrain horizon with the Sun and Earth">
      <defs>
        <linearGradient id="sky-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#081426" />
          <stop offset="1" stopColor="#172b45" />
        </linearGradient>
        <linearGradient id="ground-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#536174" />
          <stop offset="1" stopColor="#26364a" />
        </linearGradient>
      </defs>
      <rect x={L} y={T} width={W - L - R} height={H - T - B} fill="url(#sky-grad)" />
      {elTicks.map((e) => (
        <g key={`e${e}`}>
          <line x1={L} x2={W - R} y1={y(e)} y2={y(e)} stroke="#293d56" strokeWidth={e === 0 ? 1 : 0.5} />
          <text x={L - 6} y={y(e) + 3} textAnchor="end" className="sky-axis">{e}°</text>
        </g>
      ))}
      {track(site.sun_az, site.sun_el).map((p, k) => (
        <polyline key={`s${k}`} points={p} fill="none" stroke={SUN_COLOR} strokeOpacity="0.45" strokeWidth="1.5" />
      ))}
      {track(site.earth_az, site.earth_el).map((p, k) => (
        <polyline key={`t${k}`} points={p} fill="none" stroke={EARTH_COLOR} strokeOpacity="0.45" strokeWidth="1.5" />
      ))}
      <circle cx={x(site.sun_az[index])} cy={y(site.sun_el[index])} r="7" fill={SUN_COLOR} />
      <circle cx={x(site.earth_az[index])} cy={y(site.earth_el[index])} r="7" fill={EARTH_COLOR} />
      <polygon points={ground} fill="url(#ground-grad)" stroke={HORIZON_COLOR} strokeWidth="1.5" />
      {/* A body hidden behind terrain keeps a dashed outline so it can still be found. */}
      {!sunUp && (
        <circle cx={x(site.sun_az[index])} cy={y(site.sun_el[index])} r="7" fill="none"
          stroke={SUN_COLOR} strokeWidth="1.5" strokeDasharray="3 2" />
      )}
      {!earthUp && (
        <circle cx={x(site.earth_az[index])} cy={y(site.earth_el[index])} r="7" fill="none"
          stroke={EARTH_COLOR} strokeWidth="1.5" strokeDasharray="3 2" />
      )}
      {ticks.map((a) => (
        <text key={`a${a}`} x={x(a)} y={H - 8} textAnchor="middle" className="sky-axis">
          {compass[a]} {a}°
        </text>
      ))}
      <text x={W - R - 4} y={T + 12} textAnchor="end" className="sky-axis">
        Height stretched {Math.round(pxPerDegY / pxPerDegX)}x; markers not to scale
      </text>
    </svg>
  )
}

function Closeup({label, color, az, el, radius, horizon, fraction}) {
  const W = 200, H = 125, SPAN = 8                  // degrees across
  const s = W / SPAN                                 // pixels per degree, both axes
  const x = (a) => W / 2 + (((a - az + 540) % 360) - 180) * s
  const y = (e) => H / 2 - (e - el) * s
  const pts = []
  for (let a = az - SPAN / 2 - 0.5; a <= az + SPAN / 2 + 0.5; a += 0.1) {
    pts.push(`${x(a).toFixed(1)},${y(horizonAt(horizon, a)).toFixed(1)}`)
  }
  const ground = `${x(az - SPAN / 2 - 0.5)},${H} ${pts.join(' ')} ${x(az + SPAN / 2 + 0.5)},${H}`
  return (
    <figure className="sky-closeup">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label} close-up at true scale`}>
        <rect width={W} height={H} fill="#081426" />
        <circle cx={W / 2} cy={H / 2} r={radius * s} fill={color} />
        <polygon points={ground} fill="#3c4a5e" stroke={HORIZON_COLOR} strokeWidth="1.2" />
      </svg>
      <figcaption>
        {label}: {Math.round(fraction * 100)}% of disc visible. Elevation {el.toFixed(2)}°,
        terrain behind it {horizonAt(horizon, az).toFixed(2)}°, azimuth {az.toFixed(1)}°
      </figcaption>
    </figure>
  )
}

export default function SkyView({site, mast, range, index, timeLabel, playing, onTogglePlay, onIndexChange}) {
  const horizon = mast === '5m' ? site.horizon_5m : site.horizon
  const sunVis = mast === '5m' ? site.sun_5m : site.sun
  const earthVis = mast === '5m' ? site.earth_5m : site.earth
  return (
    <>
      <div className="sky-display">
        <Panorama site={site} horizon={horizon} range={range} index={index}
          sunUp={sunVis[index] >= 0.5} earthUp={earthVis[index] >= 0.5} />
      </div>
      <div className="sky-controls">
        <button type="button" className="play-button" onClick={onTogglePlay}
          aria-label={playing ? 'Pause' : 'Play through the mission'}>
          {playing ? 'Pause' : 'Play'}
        </button>
        <input type="range" min={range.from} max={range.to - 1} step={1} value={index}
          onChange={(event) => onIndexChange(Number(event.target.value))}
          aria-label="Time within the mission" />
        <span className="sky-time">{timeLabel}</span>
      </div>
      <div className="sky-closeups">
        <Closeup label="Sun" color={SUN_COLOR} az={site.sun_az[index]} el={site.sun_el[index]}
          radius={SUN_RADIUS_DEG} horizon={horizon} fraction={sunVis[index]} />
        <Closeup label="Earth" color={EARTH_COLOR} az={site.earth_az[index]} el={site.earth_el[index]}
          radius={EARTH_RADIUS_DEG} horizon={horizon} fraction={earthVis[index]} />
      </div>
    </>
  )
}
