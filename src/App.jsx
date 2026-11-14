import {useState} from 'react'
import './App.css'

function App() {

const [selectedSite, setSelectedSite] = useState('Shackleton Crater')
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
<option value="Shackleton Crater">Shackleton Crater</option>
<option value="de Gerlache Crater">de Gerlache Crater</option>
<option value="Connecting Ridge">Connecting Ridge</option>
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
<span className="verdict-status">Awating Analysis</span>
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
<p>Sunlit Time</p>
<h3>--%</h3>
<span>Of mission duration</span>
</div>
<div classNam="metric-card">
<p>Longest Darkness</p>
<h3>-- hrs</h3>
<span>Continuous time without sunglight</span>

<div className="metric-card">
<p>Earths visiblity</p>
<h3>--%</h3>
<span>Of mission duration</span>
</div>
</div>
</section>
</div>

<div className="right-column">
<section className="sky-view">
<h2>Sky View</h2>
</section>

<section className="timeline">
<h2>Mission Timeline</h2>

</section>

</div> 
</div>

</main>

)
 }
 export default App