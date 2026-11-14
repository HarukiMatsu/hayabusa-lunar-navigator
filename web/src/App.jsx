import {useEffect, useState} from 'react'
import './App.css'
import visibilityUrl from '../data/visibility.json?url'

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
const [selectedDate, setSelectedDate] = useState('')
const [missionDuration, setSelectedMissionDuration] = useState(14)
const [mastHeight, setSelectedMastHeight] = useState(2)
const handleCompare = () => {
console.log("Comparing mission settings:", {
selectedSite,
selectedDate,
missionDuration,
mastHeight
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
onChange={(event) => setSelectedMastHeight(Number(event.target.value))
}
>
<option value={1}>1 m</option>
<option value={2}>2 m</option>
<option value={3}>3 m</option>
<option value={4}>4 m</option>
<option value={5}>5 m</option>
<option value={10}>10 m</option>
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