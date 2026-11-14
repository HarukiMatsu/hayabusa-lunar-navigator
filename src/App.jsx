import {useState} from 'react'
import './App.css'

function App() {

const [selectedSite, setSelectedSite] = useState('Shacklton Crater')
const [selectedDate, setSelectedDate] = useState('')
const [missionDuration, setSelectedMissionDuration] = useState(7)
const [mastHeight, setSelectedMastHeight] = useState(2)

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

<div className="dashboard-layout">

<div className="left-column">
<section className="configuration">
<h2>Mission Configuration</h2>
</section>

<section className="verdict">
<h2>Mission Verdict</h2>
</section>

<section className="metrics">
<h2>Mission Metrics</h2>
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