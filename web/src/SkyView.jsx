// Sky view: the terrain horizon around the site with the Sun and Earth.
// Panorama: all 360 degrees of azimuth, stretched vertically so a few degrees
// of elevation are readable; Sun and Earth are markers, not to scale.
// Close-ups: 8 x 5 degree windows at equal scale, so each disc and the
// horizon behind it are drawn at their true angular sizes.
// Colours come from CSS variables (see index.css): the sky is always black.

// Mean angular radii. The Sun varies by about 1% over the year, Earth by about 7%.
const SUN_RADIUS_DEG = 0.27
const EARTH_RADIUS_DEG = 0.95

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

function visibility(site, mast) {
  return {
    horizon: mast === '5m' ? site.horizon_5m : site.horizon,
    sunVis: mast === '5m' ? site.sun_5m : site.sun,
    earthVis: mast === '5m' ? site.earth_5m : site.earth,
  }
}

export default function SkyView({site, mast, range, index}) {
  const {horizon, sunVis, earthVis} = visibility(site, mast)
  const sunUp = sunVis[index] >= 0.5
  const earthUp = earthVis[index] >= 0.5
  const W = 1200, H = 440, L = 48, R = 12, T = 14, B = 34
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
    <div className="sky-scroll">
      <svg className="sky-svg" viewBox={`0 0 ${W} ${H}`} role="img"
        aria-label={`Panorama of the terrain horizon. The Sun is ${sunUp ? 'in view' : 'hidden'} and Earth is ${earthUp ? 'in view' : 'hidden'}.`}>
        <rect x="0" y="0" width={W} height={H} className="sky-fill" />

        {elTicks.map((e) => (
          <g key={`e${e}`}>
            <line x1={L} x2={W - R} y1={y(e)} y2={y(e)} className={e === 0 ? 'sky-grid zero' : 'sky-grid'} />
            <text x={L - 8} y={y(e) + 5} textAnchor="end" className="sky-axis">{e}°</text>
          </g>
        ))}
        {track(site.sun_az, site.sun_el).map((p, k) => (
          <polyline key={`s${k}`} points={p} className="path-sun" />
        ))}
        {track(site.earth_az, site.earth_el).map((p, k) => (
          <polyline key={`t${k}`} points={p} className="path-earth" />
        ))}
        <circle cx={x(site.sun_az[index])} cy={y(site.sun_el[index])} r="10" className="body-sun" />
        <circle cx={x(site.earth_az[index])} cy={y(site.earth_el[index])} r="10" className="body-earth" />
        <polygon points={ground} className="terrain" />
        {/* A body hidden behind terrain keeps a dashed outline so it can still be found. */}
        {!sunUp && (
          <circle cx={x(site.sun_az[index])} cy={y(site.sun_el[index])} r="10" className="hidden-sun" />
        )}
        {!earthUp && (
          <circle cx={x(site.earth_az[index])} cy={y(site.earth_el[index])} r="10" className="hidden-earth" />
        )}
        {ticks.map((a) => (
          <text key={`a${a}`} x={x(a)} y={H - 10} textAnchor="middle" className="sky-axis">
            {compass[a]} {a}°
          </text>
        ))}
        <text x={W - R - 6} y={T + 16} textAnchor="end" className="sky-axis">
          Height stretched {Math.round(pxPerDegY / pxPerDegX)} times; Sun and Earth markers not to scale
        </text>
      </svg>
    </div>
  )
}

function Closeup({label, kind, az, el, radius, horizon, fraction}) {
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
    <figure className="closeup">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label} close-up at true scale`}>
        <rect width={W} height={H} className="sky-fill" />
        <circle cx={W / 2} cy={H / 2} r={radius * s} className={`body-${kind}`} />
        <polygon points={ground} className="terrain" />
      </svg>
      <figcaption>
        <strong>{label}: {Math.round(fraction * 100)}% of the disc in view.</strong>{' '}
        Elevation {el.toFixed(2)}°, terrain behind it {horizonAt(horizon, az).toFixed(2)}°.
      </figcaption>
    </figure>
  )
}

export function Closeups({site, mast, index}) {
  const {horizon, sunVis, earthVis} = visibility(site, mast)
  return (
    <div className="closeups">
      <Closeup label="Sun" kind="sun" az={site.sun_az[index]} el={site.sun_el[index]}
        radius={SUN_RADIUS_DEG} horizon={horizon} fraction={sunVis[index]} />
      <Closeup label="Earth" kind="earth" az={site.earth_az[index]} el={site.earth_el[index]}
        radius={EARTH_RADIUS_DEG} horizon={horizon} fraction={earthVis[index]} />
    </div>
  )
}
