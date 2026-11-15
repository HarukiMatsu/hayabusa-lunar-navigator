import lunarSurface from './assets/moon.jpeg'
function SouthPoleMap({sites, selectedSite, onSelect}) {
return (
<section className="south-pole-map">
<h2>South Pole Landing Sites</h2>
<div className="south-pole-map">
<svg 
viewBox="0 0 260 260" 
width="260"
height="260"
role="img"
aria-label="Map of Lunar Sout Pole landing sites"
>
<defs>
<clipPath id="moonClip" clipPath="userSpaceOnUse">
<circle cx="130" cy="130" r="116"/>
</clipPath>
</defs>

<image clipPath="url (#moonClip)"
href={lunarSurface}
x="0"
y="0"
width="260"
height="260"
preserveAspectRatio="xMidYMid slice"
/>
<circle
cx = "130"
cy = "130"
r = "116"
fill = "none"
stroke = "#82909d"
strokeWidth = "1.5"
/>
{[38,77].map((r)=>(
<circle
key={r}
cx="130"
cy="130"
r={r}
fill="none"
stroke="#526170"
/>
))}

{sites.map((site, index) => {
const distance = (90 + site.lat) * 11.6
const angle = (site.lon * Math.PI) / 180
const x = 130 + distance * Math.sin(angle)
const y = 130 - distance * Math.cos(angle)

const offsets = [
[0,0],
[-7,-7],
[7,-7],
[0,7],
[-7,7],
[7,7],
[-10,0],
[10,0],
[0,-10],
[0,10],
]

const[offsetX, offsetY] = offsets[index]
return (
<circle
key={site.id}
cx={x + offsetX}
cy={y + offsetY}
r="5"
fill={site.id === selectedSite ? "#ffd23f" : "#5b93f0"}
stroke="white"
strokeWidth="1"
onClick={() => onSelect(site.id)}
style={{ cursor: "pointer"}}
/>
)

})}

</svg>
</div>

<p>{sites.length} landing sites available</p>
</section>
)
}

export default SouthPoleMap