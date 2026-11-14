// One row per check from checkMission(): measured value and the limit, as text.

const pct = (x) => `${(100 * x).toFixed(1)}%`

export function checkRows(result, req, site) {
  const s = result.summary, t = result.thermal
  return [
    {key: 'sunlight', name: 'Sunlight', value: pct(s.sunShare), limit: `at least ${pct(req.minSunShare)}`},
    {key: 'power', name: 'Longest darkness', value: `${s.longestDarkHours} h`, limit: `at most ${req.maxDarkHours} h`},
    {key: 'comms', name: 'Earth in view', value: pct(s.earthShare), limit: `at least ${pct(req.minEarthShare)}`},
    {key: 'slope', name: 'Ground slope', value: `${site.slope_deg.toFixed(1)}°`, limit: `at most ${req.maxSlopeDeg}°`},
    {key: 'notTooHot', name: 'Hottest lander temperature', value: `${t.hottestK.toFixed(0)} K`, limit: `at most ${req.maxTempK} K`},
  ]
}
