import {useEffect, useState} from 'react'
import './App.css'
import visibilityUrl from '../data/visibility.json?url'
import {missionRange} from './model.js'

// "YYYY-MM-DDTHH:MM" in UTC, the format a datetime-local input uses.
function toInputValue(ms) {
return new Date(ms).toISOString().slice(0, 16)
}

function formatLatLon(lat, lon) {
return `${Math.abs(lat).toFixed(2)}°${lat < 0 ? 'S' : 'N'}, ${Math.abs(lon).toFixed(2)}°${lon < 0 ? 'W' : 'E'}`
}

function App() {

// The whole dataset: { meta, sites }. Loaded once from web/data/visibility.json.
const [data, setData] = useState(null)
const [loadError, setLoadError] = useState('')
const [selectedSite, setSelectedSite] = useState('')

useEffect(() => {
fetch(visibilityUrl)
.then((response) => {
if (!response.ok) throw new Error(`HTTP ${response.status}`)
return response.json()
})
.then((json) => {
setData(json)
setSelectedSite(json.sites[0].id)
})
.catch((error) => setLoadError(String(error)))
}, [])

const site = data ? data.sites.find((s) => s.id === selectedSite) : null
// Landing time as typed in the picker, "YYYY-MM-DDTHH:MM", always read as UTC.
const [selectedDate, setSelectedDate] = useState('2027-03-01T00:00')
const [missionDuration, setSelectedMissionDuration] = useState(14)
// '' is the 1 m mast and '5m' the 5 m mast, matching the field names in the data.
const [mastHeight, setSelectedMastHeight] = useState('')

// Allowed landing times: the whole mission must fit inside the data.
const HOUR_MS = 3600000
const dataStartMs = data ? Date.parse(data.meta.start_utc) : 0
const dataEndMs = data ? dataStartMs + data.meta.n_steps * data.meta.step_hours * HOUR_MS : 0
const latestLandingMs = dataEndMs - missionDuration * 24 * HOUR_MS
const landingMs = data
? Math.min(Math.max(Date.parse(`${selectedDate}:00Z`) || dataStartMs, dataStartMs), latestLandingMs)
: 0
const landingIso = data ? new Date(landingMs).toISOString() : ''
const range = data ? missionRange(data.meta, landingIso, missionDuration) : null

const handleCompare = () => {
console.log("Comparing mission settings:", {
selectedSite,
landingIso,
missionDuration,
mastHeight,
range
})
}

return (
<main className="dashboard">

<header className="topbar">
<div className="brand">

<div className="logo">
X
</div>

<div className="brand-text">
<h1>Lunar Navigator</h1>
<p> Mission Planning System</p>
</div>

</div>

<div className="topbar-information">

<div className="system-status">
{loadError ? `Data failed to load: ${loadError}` : data ? `${data.sites.length} sites loaded` : 'Loading data'}
</div>

<p>TEAM HAYABUSA</p>
</div>


</header>
<div className="mission-toolbar">
<div className="toolbar-control">
<label htmlFor="landing-site">Site:</label>
<select
id = "landing-site"
value={selectedSite}
onChange={(event) => setSelectedSite(event.target.value)}
disabled={!data}
>
{data && data.sites.map((s) => (
<option key={s.id} value={s.id}>{s.name}</option>
))}
</select>
{site && (
<span className="site-note" title="Horizons are computed in advance from terrain maps for each listed point, so custom coordinates are not available.">
{formatLatLon(site.lat, site.lon)}. Fixed points only, computed in advance from terrain maps.
</span>
)}
</div>
<div className="toolbar-control">
<label htmlFor="landing-date">Landing (UTC):</label>
<input
id="landing-date"
type="datetime-local"
step={3600}
value={data ? toInputValue(landingMs) : selectedDate}
min={data ? toInputValue(dataStartMs) : undefined}
max={data ? toInputValue(latestLandingMs) : undefined}
onChange={(event) => event.target.value && setSelectedDate(event.target.value)}
disabled={!data}
/>
</div>
<div className="toolbar-control">
<label htmlFor="mission-duration">Mission Duration (days):</label>
<select
id="mission-duration"
value={missionDuration}
onChange={(event) => setSelectedMissionDuration(Number(event.target.value))
}
>
<option value={1}>1 Day</option>
<option value={7}>7 Days</option>
<option value={14}>14 Days</option>
<option value={28}>28 Days</option>
<option value={30}>30 Days</option>
</select>
</div>

<div className="toolbar-control">
<label htmlFor="mast-height">Mast Height (meters):</label>
<select 
id="mast-height"
value={mastHeight}
onChange={(event) => setSelectedMastHeight(event.target.value)
}
>
<option value="">1 m</option>
<option value="5m">5 m</option>
</select>
</div>
<button className="compare-button" onClick={handleCompare}>
+ Compare
</button>
</div>

<div className="dashboard-layout">

<div className="left-column">

<section className="verdict">
<div className="section-heading">
<h2>Mission Verdict</h2>
<span className="verdict-status">Awaiting Analysis</span>
</div>
<h3>Ready to compare</h3>
<p>
Select your landing site and mission settings, then click 
Compare to evaluate the conditions
</p>
</section>

<section className="metrics">
<h2>Mission Metrics</h2>
<div className="metrics-grid">
<div className="metric-card">
<p>Sunlit Time</p>
<h3>--%</h3>
<span>Of mission duration</span>
</div>
<div className="metric-card">
<p>Longest Darkness</p>
<h3>-- hrs</h3>
<span>Continuous time without sunlight</span>
</div>
<div className="metric-card">
<p>Earth Visibility</p>
<h3>--%</h3>
<span>Of mission duration</span>
</div>
</div>
</section>
</div>

<div className="right-column">
<section className="sky-view">
<div className="section-heading">
<h2>Sky View</h2>
<span className="verdict-status">Simulated View</span>
</div>
<div className="sky-display">
<div className="sky-object sun"> </div>
<div className="sky-object earth"> </div>
<div className="horizon"></div>
<div className="lunar-ground"></div>
</div>

<div className="sky-legend">
<span>Sun</span>
    <span>Earth</span>
    <span>— Lunar horizon</span>
</div>


</section>

<section className="timeline">
<div className="section-heading">
<h2>Mission Timeline</h2>
<span className="verdict-status">Mission Overview</span>
</div>
<div className="timeline-events">
<div className="timeline-event">
<div className="timeline-marker sunrise"></div>
<div className="timeline-details">
<h3>Sunrise</h3>
<p>Sunlight reaches landing site</p>
<span>Day 1 : 06:00</span>
</div>
</div>
<div className="timeline-event">
<div className="timeline-marker sunset"></div>
<div className="timeline-details">
<h3>Sunset</h3>
<p>Landing site enters darkness</p>
<span>Day 1 : 18:00</span>
</div>
</div>
<div className="timeline-event">
<div className="timeline-marker sunrise"></div>
<div className="timeline-details">
<h3>Sunrise</h3>
<p>Sunlight returns to landing site</p>
<span>Day 2 : 06:00</span>
</div>
</div>


</div>
</section>

</div> 
</div>

</main>

)
 }
 export default App