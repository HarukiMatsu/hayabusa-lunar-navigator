// Map of the landing sites around the lunar south pole, drawn as plain SVG.
// Polar projection with the distance from the pole proportional to colatitude:
// r = K * (90 - |lat|). 0 deg longitude (the Earth-facing meridian) points up
// and 90 deg E points right, as seen looking down on the south pole.

const SIZE = 260
const C = SIZE / 2 // centre, the pole
const EDGE = 104 // map radius in px
const EDGE_DEG = 5 // colatitude at the map edge (85 S)
const K = EDGE / EDGE_DEG // px per degree from the pole
const RINGS = [1, 2, 3, 4] // 89, 88, 87, 86 S

function project(lat, lon) {
  const r = K * (90 - Math.abs(lat))
  const a = (lon * Math.PI) / 180
  return {x: C + r * Math.sin(a), y: C - r * Math.cos(a)}
}

export default function SouthPoleMap({sites, selectedSite, onSelect}) {
  // Draw the selected site last so it stays on top of nearby dots.
  const ordered = [...(sites || [])].sort(
    (a, b) => (a.id === selectedSite) - (b.id === selectedSite),
  )

  return (
    <section className="south-pole-map" aria-labelledby="pole-map-title">
      <h2 id="pole-map-title">South pole sites</h2>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="group" aria-label="Map of landing sites around the lunar south pole">
        <circle cx={C} cy={C} r={EDGE} className="pole-edge" />
        {RINGS.map((d) => (
          <circle key={d} cx={C} cy={C} r={K * d} className="pole-ring" />
        ))}
        <text x={C + 3} y={C - EDGE + 11} className="pole-label">85°S</text>
        <text x={C + 3} y={C - K * 4 + 11} className="pole-label">86°S</text>
        <text x={C + 3} y={C - K * 2 + 11} className="pole-label">88°S</text>

        <line x1={C - 6} x2={C + 6} y1={C} y2={C} className="pole-cross" />
        <line x1={C} x2={C} y1={C - 6} y2={C + 6} className="pole-cross" />

        <line x1={C} x2={C} y1={C - EDGE - 2} y2={C - EDGE - 14} className="pole-arrow" />
        <path d={`M ${C - 4} ${C - EDGE - 10} L ${C} ${C - EDGE - 17} L ${C + 4} ${C - EDGE - 10} Z`} className="pole-arrowhead" />
        <text x={C + 8} y={C - EDGE - 9} className="pole-label">Toward Earth</text>

        {ordered.map((site) => {
          if (!Number.isFinite(site.lat) || !Number.isFinite(site.lon)) return null
          const {x, y} = project(site.lat, site.lon)
          const selected = site.id === selectedSite
          return (
            <circle
              key={site.id}
              cx={x}
              cy={y}
              r={selected ? 5 : 4}
              className={selected ? 'pole-site selected' : 'pole-site'}
              role="button"
              tabIndex={0}
              aria-label={site.name}
              aria-pressed={selected}
              onClick={() => onSelect(site.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelect(site.id)
                }
              }}
            >
              <title>{site.name}</title>
            </circle>
          )
        })}
      </svg>
      <p className="note">{(sites || []).length} sites. Rings every 1° of latitude; nearby sites overlap.</p>
    </section>
  )
}
