import {useEffect, useState} from 'react'
import './App.css'
import visibilityUrl from '../data/visibility.json?url'
import {checkMission, DEFAULT_LANDER, DEFAULT_REQUIREMENTS, missionRange, series, summarise, UP} from './model.js'
import Verdict from './Verdict.jsx'
import Requirements from './Requirements.jsx'
import Compare from './Compare.jsx'
import Calendar from './Calendar.jsx'
import SkyView, {Closeups} from './SkyView.jsx'
import Timeline from './Timeline.jsx'
import Countdown from './Countdown.jsx'

function formatPct(share) {
return `${(100 * share).toFixed(1)}`
}

// "YYYY-MM-DDTHH:MM" in UTC, the format a datetime-local input uses.
function toInputValue(ms) {
return new Date(ms).toISOString().slice(0, 16)
}

function formatLatLon(lat, lon) {
return `${Math.abs(lat).toFixed(2)}°${lat < 0 ? 'S' : 'N'}, ${Math.abs(lon).toFixed(2)}°${lon < 0 ? 'W' : 'E'}`
}

function Metric({value, unit, label}) {
return (
<div className="metric">
<dt>{label}</dt>
<dd><span className="numeral">{value}</span><span className="unit">{unit}</span></dd>
</div>
)
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
? `${new Date(dataStartMs + timeIndex * data.meta.step_hours * HOUR_MS).toISOString().slice(0, 16).replace('T', ' ')} UTC, day ${Math.floor(offset / 24) + 1}, hour ${offset % 24}`
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
const jumpTo = (i) => {
setPlaying(false)
setTimeOffset(i - range.from)
}

// The page is lit by the Sun in the data: light theme when at least half the
// Sun's disc is visible at the selected hour, dark theme otherwise.
const lit = site && range ? series(site, 'sun', mastHeight)[timeIndex] >= UP : true
useEffect(() => {
document.documentElement.dataset.theme = lit ? 'lit' : 'shadow'
}, [lit])

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
<h1>Hayabusa lunar navigator</h1>
<p className="status" role="status">
{loadError ? `Data failed to load: ${loadError}` : data ? `${data.sites.length} sites loaded. Sun ${lit ? 'in view' : 'hidden'} at the selected hour.` : 'Loading data'}
</p>
</header>

<section className="sky-block" aria-labelledby="sky-title">
<div className="block-heading">
<h2 id="sky-title">Sky from {site ? site.name : 'the site'}</h2>
<p className="note">Terrain horizon for a {mastHeight === '5m' ? '5 m' : '1 m'} mast, from LOLA elevation maps.</p>
</div>
{site && range ? (
<>
<SkyView site={site} mast={mastHeight} range={range} index={timeIndex} />
<p className="legend">
<span className="key key-sun" aria-hidden="true" /> Sun and its path.{' '}
<span className="key key-earth" aria-hidden="true" /> Earth and its path.{' '}
A dashed circle marks a body hidden behind the terrain.
</p>
<div className="time-controls">
<button type="button" className="button" onClick={togglePlay}
aria-label={playing ? 'Pause' : 'Play through the mission'}>
{playing ? 'Pause' : 'Play'}
</button>
<span className="time-label">{timeLabel}</span>
</div>
<input className="time-slider" type="range" min={range.from} max={range.to - 1} step={1} value={timeIndex}
onChange={(event) => jumpTo(Number(event.target.value))}
aria-label="Time within the mission" aria-valuetext={timeLabel} />
<Timeline
sunVis={series(site, 'sun', mastHeight)}
earthVis={series(site, 'earth', mastHeight)}
range={range}
index={timeIndex}
stepHours={data.meta.step_hours}
onIndexChange={jumpTo}
/>
<p className="legend">
<span className="key key-sun" aria-hidden="true" /> At least half the Sun in view.{' '}
<span className="key key-sun-partial" aria-hidden="true" /> Part of the Sun in view.{' '}
<span className="key key-earth" aria-hidden="true" /> At least half of Earth in view. Select a bar to jump to that hour.
</p>
<div className="now">
<Countdown
site={site}
mast={mastHeight}
index={timeIndex}
range={range}
stepHours={data.meta.step_hours}
startMs={dataStartMs}
/>
<Closeups site={site} mast={mastHeight} index={timeIndex} />
</div>
</>
) : (
<div className="sky-placeholder" />
)}
</section>

<div className="lower">

<aside className="controls" aria-label="Mission settings">
<label className="field">
<span>Site</span>
<select
value={selectedSite}
onChange={(event) => setSelectedSite(event.target.value)}
disabled={!data}
>
{data && data.sites.map((s) => (
<option key={s.id} value={s.id}>{s.name}</option>
))}
</select>
</label>
{site && (
<p className="note">
{formatLatLon(site.lat, site.lon)}. Fixed points only: horizons are computed in advance from terrain maps, so custom coordinates are not available.
</p>
)}
<label className="field">
<span>Landing time (UTC)</span>
<input
type="datetime-local"
step={3600}
value={data ? toInputValue(landingMs) : selectedDate}
min={data ? toInputValue(dataStartMs) : undefined}
max={data ? toInputValue(latestLandingMs) : undefined}
onChange={(event) => event.target.value && setSelectedDate(event.target.value)}
disabled={!data}
/>
</label>
<label className="field">
<span>Mission length</span>
<select
value={missionDuration}
onChange={(event) => setSelectedMissionDuration(Number(event.target.value))}
>
<option value={1}>1 day</option>
<option value={7}>7 days</option>
<option value={14}>14 days</option>
<option value={28}>28 days</option>
<option value={30}>30 days</option>
</select>
</label>
<label className="field">
<span>Mast height</span>
<select
value={mastHeight}
onChange={(event) => setSelectedMastHeight(event.target.value)}
>
<option value="">1 m</option>
<option value="5m">5 m</option>
</select>
</label>
<button type="button" className="button" onClick={handleCompare}
disabled={!data || scenarios.length >= MAX_SCENARIOS}>
Add to comparison ({scenarios.length} of {MAX_SCENARIOS})
</button>
<Requirements req={requirements} onChange={setRequirements} />
</aside>

<div className="results">

<section aria-labelledby="metrics-title">
<h2 id="metrics-title">Mission metrics</h2>
{summary ? (
<dl className="metrics">
<Metric value={formatPct(summary.sunShare)} unit="%" label="Sunlit, average share of the Sun's disc" />
<Metric value={formatPct(summary.earthShare)} unit="%" label="Earth in view" />
<Metric value={formatPct(summary.bothShare)} unit="%" label="Sun and Earth together" />
<Metric value={summary.longestDarkHours} unit="h" label={`Longest darkness, ${(summary.longestDarkHours / 24).toFixed(1)} days`} />
<Metric value={summary.longestCommsGapHours} unit="h" label={`Longest comms gap, ${(summary.longestCommsGapHours / 24).toFixed(1)} days`} />
</dl>
) : (
<p className="note">Loading data</p>
)}
</section>

{verdict ? <Verdict result={verdict} req={requirements} site={site} /> : null}

<section aria-labelledby="calendar-title">
<h2 id="calendar-title">Landing calendar{site ? ` for ${site.name}` : ''}</h2>
<p className="note">{missionDuration} {missionDuration === 1 ? 'day' : 'days'}, {mastHeight === '5m' ? '5 m' : '1 m'} mast, current requirements.</p>
{site ? (
<Calendar
meta={data.meta}
site={site}
requirements={requirements}
mast={mastHeight}
year={new Date(dataStartMs).getUTCFullYear()}
selectedDay={landingIso.slice(0, 10)}
missionDays={missionDuration}
onPick={(date) => {
setPlaying(false)
setTimeOffset(0)
setSelectedDate(`${date}T00:00`)
}}
/>
) : null}
</section>

<section aria-labelledby="compare-title">
<h2 id="compare-title">Compare scenarios</h2>
<p className="note">Every scenario uses the current requirements.</p>
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

</div>
</div>

</main>
)
}
export default App
