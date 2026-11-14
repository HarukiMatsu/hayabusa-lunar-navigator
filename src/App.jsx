import {useState} from 'react'
import './App.css'
import visibilityData from './data/sample_visibility.json'

function expandRuns(runs) {
return runs.flatMap((item)=> {
if (Array.isArray(item)) {
const [value, count] = item
return Array(count).fill(value)
}
return [item]
})
}

function calculateSunlitPercentage(sunHours) {
const sunlitHours = sunHours.filter(value => value > 0).length
return (sunlitHours / sunHours.length) * 100
}


function calculateLongestDarkness(sunHours) {
let longestDarkness = 0
let currentDarkness = 0

sunHours.forEach((value) => {
if (value === 0) {
currentDarkness++
longestDarkness = Math.max(longestDarkness, currentDarkness)
}
else {
currentDarkness = 0
}
})
return longestDarkness
}

function calculateEarthVisibilityPercentage(earthHours) {
const totalvisiblity = earthHours.reduce(
(total, value) => total + value,
0
)
return (totalvisiblity / earthHours.length) * 100
}


function App() {

const [selectedSite, setSelectedSite] = useState('malapert_massif')
const [selectedDate, setSelectedDate] = useState('')
const [missionDuration, setSelectedMissionDuration] = useState(14)
const [mastHeight, setSelectedMastHeight] = useState(2)
const siteData = visibilityData.sites.find(
(site) => site.id === selectedSite
)
const hoursToAnalyse = missionDuration * 24
const sunHours = expandRuns(siteData.sun).slice(0, hoursToAnalyse)
const earthHours = expandRuns(siteData.earth).slice(0, hoursToAnalyse)
const sunlitPercentage = calculateSunlitPercentage(sunHours)
const longestDarkness = calculateLongestDarkness(sunHours)
const earthVisibility = calculateEarthVisibilityPercentage(earthHours)

let verdict = "Marginal"
if (sunlitPercentage < 50 || longestDarkness > 96) {
verdict = "no go"
}
else if (
sunlitPercentage >= 70 &&
  longestDarkness <= 48 &&
  earthVisibility >= 50
) {
  verdict = "viable"
}
const rankedSites = visibilityData.sites.map((site) => {
const siteSunHours = expandRuns(site.sun).slice(0, hoursToAnalyse)
const siteEarthHours = expandRuns(site.earth).slice(0, hoursToAnalyse)

const siteSunlit = calculateSunlitPercentage(siteSunHours)
const siteDarkness = calculateLongestDarkness(siteSunHours)
const siteEarthVisiblity = calculateEarthVisibilityPercentage(siteEarthHours)

let siteVerdict = "Marginal"
if(siteSunlit < 50 || siteDarkness > 96) {
siteVerdict = "No Go"
}
else if (
siteSunlit >= 70 && 
siteDarkness <= 48 && 
siteEarthVisiblity >=50
){
siteVerdict = "Visible"
}
return {
name: site.name,
sunlit: siteSunlit,
darkness: siteDarkness,
earthVisibility: siteEarthVisiblity,
verdict: siteVerdict
}
}).sort((a, b) => {
const priority = {"Viable" : 0, "Marginal" : 1, "No Go" : 2}
return priority[a.verdict] - priority[b.verdict] ||
b.sunlit - a.sunlit || a.darkness - b.darkness || b.earthVisibility - a.earthVisibility
})


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

<div className="tobbar-information">

<div className="system-status">
System Ready
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
>
<option value="malapert_massif">Malapert Massif</option>
<option value="haworth">Haworth</option>
<option value="de_gerlache_rim_2">de Gerlache Rim 2</option>
<option value="nobile_rim_1">Nobile Rim 1</option>
</select>
</div>
<div className="toolbar-control">
<label htmlFor="mission-duration">Mission Duration (days):</label>
<select
id="mission-duration"
value={missionDuration}
onChange={(event) => setSelectedMissionDuration(Number(event.target.value))
}
>
<option value={1}>1 Days</option>
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
<span className="verdict-status">Analysis Complete</span>
</div>
<h3>{verdict}</h3>
<p>
Select your landing site and mission settings, then click 
Compare to evaluate the conditions
</p>
</section>
<section className= "metrics">
<h2>Mission Metrics</h2>
<div className="metrics-grid">
<div className="metric-card">
<p>Sunlit Time</p>
<h3>{sunlitPercentage.toFixed(1)}</h3>
<span>Of mission duration</span>
</div>
<div className="metric-card">
<p>Longest Darkness</p>
<h3>{longestDarkness}hrs</h3>
<span>Continuous time without sunlight</span>
</div>
<div className="metric-card">
<p>Earth Visibility</p>
<h3>{earthVisibility.toFixed(1)}%</h3>
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
<div className={"sky-object sun ${sunHours[0]>0 ? 'visible' : 'hidden'}"}> </div>
<div className={"sky-object earth ${earthHours[0]>0 ? 'visible' : 'hidden'"}> </div>
<div className="horizion"></div>
<div className="lunar-ground"></div>
</div>

<div className="sky-legend">
<span>Sun: {sunHours[0] > 0 ? 'Visible' : 'Hidden'}</span>
  <span>Earth: {earthHours[0] > 0 ? 'Visible' : 'Hidden'}</span>
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