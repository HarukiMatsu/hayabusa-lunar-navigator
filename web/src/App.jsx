import {useEffect, useState} from 'react'
import './App.css'
import visibilityUrl from '../data/visibility.json?url'
import {checkMission, DEFAULT_LANDER, DEFAULT_REQUIREMENTS, missionRange, series, summarise} from './model.js'
import Verdict from './Verdict.jsx'
import Compare from './Compare.jsx'
import SkyView from './SkyView.jsx'
import Timeline from './Timeline.jsx'
import Countdown from './Countdown.jsx'

function formatPct(share) {
return `${(100 * share).toFixed(1)}%`
}

function formatHours(hours) {
return `${hours} hrs`
}

function formatDays(hours) {
return `${(hours / 24).toFixed(1)} days. `
}

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
const summary = site && range ? summarise(site, range, data.meta.step_hours, mastHeight) : null

// Requirements for the verdict, shared with the compare cards and the calendar.
const [requirements, setRequirements] = useState(DEFAULT_REQUIREMENTS)
const verdict = site && range
? checkMission(site, range, requirements, DEFAULT_LANDER, data.meta.step_hours, mastHeight)
: null

// Selected moment within the mission, as hours after landing. Shared by the
// sky view, timeline and countdown. Play steps one hour every 60 ms.
const [timeOffset, setTimeOffset] = useState(0)
const [playing, setPlaying] = useState(false)
const windowHours = range ? range.to - range.from : 0
const offset = Math.min(Math.max(timeOffset, 0), Math.max(windowHours - 1, 0))
const timeIndex = range ? range.from + offset : 0
const timeLabel = data
? `${new Date(dataStartMs + timeIndex * data.meta.step_hours * HOUR_MS).toISOString().slice(0, 16).replace('T', ' ')} UTC, day ${Math.floor(offset / 24) + 1} hour ${offset % 24}`
: ''

useEffect(() => {
if (!playing) return undefined
const timer = setInterval(() => {
setTimeOffset((t) => {
if (t + 1 >= windowHours) {
setPlaying(false)
return t
}
return t + 1
})
}, 60)
return () => clearInterval(timer)
}, [playing, windowHours])

const togglePlay = () => {
if (!playing && offset >= windowHours - 1) setTimeOffset(0)
setPlaying(!playing)
}

// Saved scenarios for side-by-side comparison (at most MAX_SCENARIOS).
const MAX_SCENARIOS = 4
const [scenarios, setScenarios] = useState([])
const handleCompare = () => {
if (!data || scenarios.length >= MAX_SCENARIOS) return
const key = `${selectedSite}|${landingIso}|${missionDuration}|${mastHeight}`
if (scenarios.some((sc) => sc.key === key)) return
setScenarios([...scenarios, {key, siteId: selectedSite, landingIso, missionDays: missionDuration, mast: mastHeight}])
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
<button className="compare-button" onClick={handleCompare}
disabled={!data || scenarios.length >= MAX_SCENARIOS}
title={scenarios.length >= MAX_SCENARIOS ? `Up to ${MAX_SCENARIOS} scenarios; remove one to add another` : 'Add these settings to the comparison'}>
+ Compare{scenarios.length ? ` (${scenarios.length}/${MAX_SCENARIOS})` : ''}
</button>
</div>

<div className="dashboard-layout">

<div className="left-column">

<section className="verdict">
<div className="section-heading">
<h2>Mission Verdict</h2>
<span className={`verdict-status ${verdict ? (verdict.pass ? 'status-pass' : 'status-fail') : ''}`}>
{verdict ? (verdict.pass ? 'Pass' : 'Fail') : 'Awaiting Analysis'}
</span>
</div>
{verdict ? (
<Verdict result={verdict} req={requirements} onReqChange={setRequirements} site={site} />
) : (
<p>Loading data</p>
)}
</section>

<section className="metrics">
<h2>Mission Metrics</h2>
<div className="metrics-grid">
<div className="metric-card">
<p>Sunlit Time</p>
<h3>{summary ? formatPct(summary.sunShare) : '--%'}</h3>
<span>Average share of the Sun's disc in view</span>
</div>
<div className="metric-card">
<p>Earth Visibility</p>
<h3>{summary ? formatPct(summary.earthShare) : '--%'}</h3>
<span>Of mission duration, Earth at least half in view</span>
</div>
<div className="metric-card">
<p>Sun and Earth Together</p>
<h3>{summary ? formatPct(summary.bothShare) : '--%'}</h3>
<span>Power and direct contact at the same time</span>
</div>
<div className="metric-card">
<p>Longest Darkness</p>
<h3>{summary ? formatHours(summary.longestDarkHours) : '-- hrs'}</h3>
<span>{summary ? formatDays(summary.longestDarkHours) : ''}Continuous time without sunlight</span>
</div>
<div className="metric-card">
<p>Longest Comms Gap</p>
<h3>{summary ? formatHours(summary.longestCommsGapHours) : '-- hrs'}</h3>
<span>{summary ? formatDays(summary.longestCommsGapHours) : ''}Continuous time without Earth in view</span>
</div>
</div>
</section>

<section className="metrics">
<h2>Next Change</h2>
{site && range ? (
<Countdown
site={site}
mast={mastHeight}
index={timeIndex}
range={range}
stepHours={data.meta.step_hours}
startMs={dataStartMs}
/>
) : null}
<p className="panel-note">From the time selected in the sky view or timeline: {timeLabel}</p>
</section>
</div>

<div className="right-column">
<section className="sky-view">
<div className="section-heading">
<h2>Sky View</h2>
<span className="verdict-status">Terrain horizon, {mastHeight === '5m' ? '5 m' : '1 m'} mast</span>
</div>
{site && range ? (
<SkyView
site={site}
mast={mastHeight}
range={range}
index={timeIndex}
timeLabel={timeLabel}
playing={playing}
onTogglePlay={togglePlay}
onIndexChange={(i) => {
setPlaying(false)
setTimeOffset(i - range.from)
}}
/>
) : (
<div className="sky-display" />
)}

<div className="sky-legend">
<span className="legend-sun">Sun and its path</span>
<span className="legend-earth">Earth and its path</span>
<span>Line: terrain horizon from LOLA elevation maps</span>
<span>Close-ups are at true angular size</span>
</div>


</section>

<section className="timeline">
<div className="section-heading">
<h2>Mission Timeline</h2>
<span className="verdict-status">{missionDuration} {missionDuration === 1 ? 'day' : 'days'}, hourly</span>
</div>
{site && range ? (
<Timeline
sunVis={series(site, 'sun', mastHeight)}
earthVis={series(site, 'earth', mastHeight)}
range={range}
index={timeIndex}
stepHours={data.meta.step_hours}
onIndexChange={(i) => {
setPlaying(false)
setTimeOffset(i - range.from)
}}
/>
) : null}
<div className="sky-legend">
<span className="legend-sun">Sun at least half in view</span>
<span className="legend-sun-partial">Sun partly in view</span>
<span className="legend-earth">Earth at least half in view</span>
<span>Click a bar to jump to that hour</span>
</div>
</section>

</div>
</div>

<section className="compare-section">
<div className="section-heading">
<h2>Compare Scenarios</h2>
<span className="verdict-status">Same requirements for every card</span>
</div>
{data ? (
<Compare
data={data}
scenarios={scenarios}
req={requirements}
max={MAX_SCENARIOS}
onRemove={(key) => setScenarios(scenarios.filter((sc) => sc.key !== key))}
/>
) : null}
</section>

</main>

)
 }
 export default App