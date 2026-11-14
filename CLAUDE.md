# Lunar Landing Site Navigator (Team Hayabusa)

Project brief for Claude Code. NASA Space Apps Challenge 2026, London local event, Saturday 14 and Sunday 15 November 2026. Team owner and data/geometry lead: Haruki.

Read this whole file before doing anything in this repo.

---

## 0. Rules (always follow)

1. **Timing rule.** Space Apps does not allow work on the submission before **09:00 local time, Saturday 14 November 2026**. Before then this repo is for **practice only**: learning the data and libraries, throwaway study scripts, checking downloads and kernels. Anything written before 09:00 Saturday goes in `study/` and is deleted before the event. If asked to build the real pipeline or app before then, say so and offer a practice version in `study/` instead. From 09:00 Saturday, build normally.
2. **Explain before running.** Before running or committing code, explain in plain terms what it does and what every printed number measures. Haruki must be able to answer a judge's questions about every part of the project.
3. **Small steps.** Build one piece, run it, check the output against something known, then move on. Never write a large untested chunk.
4. **AI disclosure.** Keep a running log in `docs/ai_use.md`: date, what Claude Code was asked to do, what it produced. The submission has a mandatory "Use of Artificial Intelligence" field.
5. **Cite everything.** Every dataset, paper and library goes in `docs/references.md`. Missing citations can cost the nomination.
6. **User facing text** (README, UI copy, project page): plain English, no em dashes, no AI sounding phrasing.
7. **Maths** in docs as LaTeX.
8. **No NASA logos or insignia** anywhere in the app or video.
9. **Never commit large data.** `raw/` and `kernels/` are git ignored.

---

## 1. What we are building

A web tool that lets someone pick a lunar landing site and a date and immediately see when the Sun and Earth are above the horizon there, so they can compare sites and dates for **solar power** and **direct-to-Earth communication**.

**Demo story:** *"Our landing slipped from March to June. Which of these four sites still has power and comms?"* One click, answer in seconds.

**Why it matters (from the challenge statement):** tools that compute this exist (Quickmap, Moon Trek, JPL Horizons) but are slow and hard for non-specialists to use for comparing scenarios. Launches slip, so planners need to re-evaluate sites and dates fast.

**Judging criteria:** impact, creativity, validity, relevance, presentation. We win on **validity** (real terrain horizons, numbers checked against published results) plus a fast, clear interface.

Challenge page: https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/

---

## 2. Physics

### Why the south pole is hard
- The Sun never rises more than about 1.5° above the horizon at the pole (about 2° at 89.5°S). It circles the whole horizon once per synodic month (29.53 d).
- Terrain higher than the Sun in its direction blocks it. Ridge crests can be lit 80 to 90% of the time; crater floors a few km away are permanently dark.
- Earth sits near the direction of 0° longitude, right on the horizon, moving up and down about ±6.7° over 27.2 d (libration).
- Sun and Earth are in different directions, so terrain blocks them separately. Their periods differ, so they drift in and out of step: the same site can be good on one date and poor two weeks later.
- At the equator (Apollo sites) Earth is always high and the Sun gives about 14.8 d of day then 14.8 d of night. Good contrast for the demo.

### Horizon mask
Observer height $h_0$ = ground height + mast height. Along azimuth $\alpha$:

$$\theta_{\mathrm{hor}}(\alpha) = \max_{d} \arctan\!\left(\frac{h(d,\alpha) - h_0 - \dfrac{d^{2}}{2R}}{d}\right), \qquad R = 1737.4\ \text{km}$$

- $d^2/2R$ is lunar curvature (29 m at 10 km, 720 m at 50 km).
- No atmosphere, no refraction.
- Azimuth clockwise from local north, 1° steps, 360 values.
- Find local north on the polar stereographic grid numerically (convert the point to lat/lon, nudge latitude, convert back). Do not assume grid axis directions.
- Never put an observer exactly at 90°S.

### Topocentric azimuth and elevation
Local unit vectors at latitude $\phi$, longitude $\lambda$ in the Moon fixed frame (MOON_ME):

$$\hat{\mathbf u} = (\cos\phi\cos\lambda,\ \cos\phi\sin\lambda,\ \sin\phi)$$
$$\hat{\mathbf e} = (-\sin\lambda,\ \cos\lambda,\ 0)$$
$$\hat{\mathbf n} = (-\sin\phi\cos\lambda,\ -\sin\phi\sin\lambda,\ \cos\phi)$$

For a body at Moon centred position $\mathbf B$, site radius $r = R + h_0$, $\mathbf v = \mathbf B - r\hat{\mathbf u}$:

$$\text{az} = \operatorname{atan2}(\mathbf v\cdot\hat{\mathbf e},\ \mathbf v\cdot\hat{\mathbf n}),\qquad \text{el} = \arcsin\!\left(\frac{\mathbf v\cdot\hat{\mathbf u}}{|\mathbf v|}\right)$$

Subtracting the site position (parallax) matters for Earth (about 0.26°) and is negligible for the Sun. This is why one shared ephemeris file can serve every site.

### Partial Sun
Sun angular radius $\rho \approx 0.27^\circ$. With $\Delta = \text{el}_\odot - \theta_{\mathrm{hor}}(\text{az}_\odot)$ and $x = \operatorname{clamp}(\Delta/\rho, -1, 1)$, the visible fraction of the disc is

$$f_\odot = \frac12 + \frac{x\sqrt{1-x^2} + \arcsin x}{\pi}$$

### Visibility
- Sun **lit** when $f_\odot \ge 0.5$.
- Earth **visible** when $\text{el}_\oplus - \theta_{\mathrm{hor}}(\text{az}_\oplus) > m$, comms margin $m$ default 0°.

---

## 3. Metrics (per mission window, hourly samples, UTC)

| Metric | Definition |
|---|---|
| Sunlit % | mean of $f_\odot$ over the window |
| Longest darkness | longest run of consecutive not lit hours |
| Earth visible % | fraction of hours Earth is visible |
| Longest blackout | longest run of hours Earth is not visible |
| Both % | hours lit and Earth visible at the same time |
| Time to sunset / Earthset | from the chosen time to the next switch to not lit / not visible |
| Solar elevation | Sun elevation at the chosen time |

**Verdict** (our demo defaults, adjustable, labelled on screen as not NASA requirements):
- **Viable:** sunlit ≥ 70%, longest darkness ≤ 48 h, Earth visible ≥ 50%
- **Marginal:** power passes and comms fails, or the reverse
- **No go:** sunlit < 50% or longest darkness > 96 h

---

## 4. Architecture

Heavy work offline in Python. The web app is static and only does light maths, so nothing can fail live during judging.

1. **Ephemeris file** (one, shared by all sites). Hourly, 2024 to 2030. Sun unit vector and Earth position (km), Moon centred, frame **MOON_ME (DE421)**. Made once with `spiceypy`. The browser applies the az/el maths above for any site.
2. **Horizon grids** (one per PGDA site). Horizon masks on a regular grid of points inside each DEM tile, 100 to 200 m spacing, each file under about 2 MB. Two mast heights: 1 m and 5 m. Stored int16 in hundredths of a degree. Custom points inside a tile snap to the nearest grid point.
3. **Single horizons** for Apollo and other non polar sites: limb only (flat) horizon, clearly labelled. Equatorial horizons barely matter.
4. **Outside any tile:** limb only horizon with an on screen warning.
5. **Frontend:** plain JS (or React if the frontend person prefers). Canvas or D3 for the sky view and timeline, Leaflet for the tile map. All metrics computed in the browser.
6. **Hosting:** static (GitHub Pages or Netlify). Public repo, Apache 2.0 licence.

### Repo layout
```
CLAUDE.md          this file
README.md          public description (written Sunday)
.gitignore         includes raw/, kernels/, __pycache__/, .venv/
pipeline/          Python: DEM loading, horizon grids, ephemeris, validation
web/               frontend
web/data/          generated files the app loads (data contract below)
docs/
  references.md    every dataset, paper, library
  ai_use.md        AI disclosure log
  papers/          PDFs (Barker 2021, Mazarico 2011)
  validation/      validation plots
study/             practice scripts, DELETE before 09:00 Sat
raw/
  dem/             PGDA site DEMs, slopes, ROI shapefiles, README
  mosaic/          87 to 90°S mosaic (optional)
kernels/           SPICE kernels
```

---

## 5. Data contract (`web/data/`)

(Revised Saturday 14 Nov. This replaces the earlier multi-file contract and the in-browser ephemeris in section 4: all az/el and visibility is now precomputed in Python.)

The web app reads **one file**, `web/data/visibility.json`:

```
{
  "meta": { "start_utc": "2027-01-01T00:00:00Z", "step_hours": 1, "n_steps": 8760 },
  "sites": [ {
    "id", "name", "lat", "lon", "height_m", "slope_deg", "slope_facing_deg",
    "sun": [...], "earth": [...],            // fraction of disc above terrain, 0..1, 1 m mast
    "sun_5m": [...], "earth_5m": [...],      // same for a 5 m mast
    "sun_az": [...], "sun_el": [...], "earth_az": [...], "earth_el": [...],   // degrees
    "horizon": [...], "horizon_5m": [...],   // 720 terrain elevation angles, 0.5 deg steps from north
    "ground_temp_k": [...]
  } ]
}
```

Conventions:
- All times UTC. Sample $i$ is at `start_utc` $+\ i \times$ `step_hours`.
- Azimuth in degrees clockwise from local north; elevation in degrees above the local horizontal plane.
- Longitude east positive, $[-180, 180]$.
- Every hourly list has exactly `n_steps` entries. `horizon` and `horizon_5m` have 720 entries, index $k$ at azimuth $0.5k$ degrees.
- All numbers rounded to 2 decimals.

Built by `pipeline/build.py`. Pipeline modules: `ephemeris.py`, `terrain.py`, `horizon.py`, `visibility.py`, `thermal.py`, `build.py`, `validate.py`.

---

## 6. Features

**Must have (end of Saturday)**
1. Site picker: grouped list plus custom lat/lon
2. Date/time picker (UTC) and mission length (default 14 days)
3. Sky view: 360° horizon profile with Sun and Earth now, and their tracks over the window
4. Timeline: sunlight and Earth visibility bars, mission window highlighted
5. Metrics panel (section 3)
6. Compare at least two scenarios side by side

**Should have (Sunday morning)**
1. Verdict label with reason
2. Mast height switch (1 m / 5 m) and comms margin slider
3. Map of the site tile coloured by slope or sunlit %, click to move the observer
4. "Next good window": next start date where the verdict is viable

**Nice to have:** error bars from the DEM clones, 3D terrain, educator mode.

**Feature freeze: Sunday 12:00.** Bug fixes only after that.

---

## 7. Validation (must do; one plot goes in the pitch)

1. **Horizon:** synthetic flat DEM with a known block; horizon angle matches hand calculation.
2. **Ephemeris:** our az/el vs SPICE `azlcpo` (should agree to about 0.001°) and vs JPL Horizons (a few hundredths of a degree; Horizons uses a newer ephemeris).
3. **Published values:** Site01 and Site04, 1 Jan 2024 to 1 Jan 2026, 1 m height: average illumination and longest night vs Barker et al. (2021). PGDA states Site01 has the most area with average illumination above 70% at 1 m. Expect our numbers slightly higher if far field terrain is missing; report the difference.
4. **Sanity:** Apollo 11 Earth visible 100%; a crater floor sunlit 0%; Sun elevation within about ±2° near 89.5°S.

**If validation fails, check in this order:** azimuth convention (clockwise from north), local north direction on the grid, frame (must be DE421 MOON_ME to match the DEMs), UTC vs TDB, degrees vs radians.

---

## 8. Data to download

Save in the folders shown. Download on good wifi before the event, ideally onto two laptops.

### 8.1 Site DEMs (essential)
Page: **https://pgda.gsfc.nasa.gov/products/78** (NASA GSFC Planetary Geodesy Data Archive, "High-Resolution LOLA Topography for Lunar South Pole Sites").

On the page, scroll to the site headings. The links are the filenames after the colons. Click only the **LDEM**, **slope** and **ROI shapefile** lines. Do not click XYZI, LDEC, uncertainty files, or the numbered clone links.

Save to `raw/dem/`:

| Site | Elevation | Slope | Regions |
|---|---|---|---|
| Site01, Connecting ridge | `Site01_final_adj_5mpp_surf.tif` | `Site01_final_adj_5mpp_slp.tif` | `Site01_ROIs.tgz` |
| Site04, Shackleton rim | `Site04_final_adj_5mpp_surf.tif` | `Site04_final_adj_5mpp_slp.tif` | `Site04_ROIs.tgz` |
| Site11, de Gerlache rim | `Site11_final_adj_5mpp_surf.tif` | `Site11_final_adj_5mpp_slp.tif` | `Site11_ROIs.tgz` |
| Site23, Malapert massif | `Site23_final_adj_5mpp_surf.tif` | `Site23_final_adj_5mpp_slp.tif` | (none listed) |

Also download the **README** linked near the top of the page ("See this README file") into `raw/dem/`.

File format: 5 m/pixel GeoTIFF, south polar stereographic X/Y in metres, MOON_ME frame of DE421. Pixel value = surface height in metres. About 90% of pixels are interpolated between laser tracks.

More sites available later if time allows: Site06, Site07, Site20, Site20v2, Site42, Haworth, Shoemaker, DM1, DM2, SL2, SL3, NPA, NPB, NPC, NPD, LM1 to LM8.

### 8.2 SPICE kernels (essential)
Save to `kernels/`. From the project root (macOS or Linux; on Windows use `curl.exe` in PowerShell):

```bash
mkdir -p kernels && cd kernels
B=https://naif.jpl.nasa.gov/pub/naif/generic_kernels
curl -O $B/lsk/naif0012.tls
curl -O $B/pck/pck00010.tpc
curl -O $B/spk/planets/de421.bsp
curl -O $B/pck/moon_pa_de421_1900-2050.bpc
curl -O $B/fk/satellites/moon_080317.tf
cd ..
```

| File | What it is |
|---|---|
| `naif0012.tls` | leap seconds (UTC to TDB) |
| `pck00010.tpc` | body radii and constants |
| `de421.bsp` | Sun, Earth, Moon positions (about 17 MB) |
| `moon_pa_de421_1900-2050.bpc` | Moon orientation including libration |
| `moon_080317.tf` | defines the MOON_ME frame used by the DEMs |

Load all five with `spiceypy.furnsh`. Use `spkpos(target, et, "MOON_ME", "LT+S", "MOON")`.

### 8.3 Far field mosaic (strongly recommended)
Page: **https://pgda.gsfc.nasa.gov/products/81** (also reachable from the PGDA home page as "A New View of the Lunar South Pole from LOLA"). 5 m/pixel DEM covering 87 to 90°S. Needed because mountains tens of km away block the low Sun and each site tile is only a few km across. Large file. Save to `raw/mosaic/`. Downsample to 50 to 100 m for distances beyond a few km.

### 8.4 Papers (save to `docs/papers/`)
- **Barker et al. (2021)**, Improved LOLA Elevation Maps for South Pole Landing Sites, Planetary and Space Science 203, 105119, doi:10.1016/j.pss.2020.105119. Free copy: https://ntrs.nasa.gov/citations/20205009660 . Validation numbers. Required citation for the DEMs.
- **Mazarico et al. (2011)**, Illumination conditions of the lunar polar regions using LOLA topography, Icarus 211, 1066 to 1081, doi:10.1016/j.icarus.2010.10.030. Method and site numbering. Use Imperial login if paywalled.

### 8.5 No download needed
- **JPL Horizons** API via `astroquery.jplhorizons`, observer `{"body": 301, "lon", "lat", "elevation" (km)}`: https://ssd.jpl.nasa.gov/horizons/
- **NASA SVS** south pole illumination animation 2025 to 2028: https://svs.gsfc.nasa.gov/5027

### 8.6 Optional
- PGDA Lunar Polar Illumination maps (product 69): https://pgda.gsfc.nasa.gov/products/69
- LROC WAC south pole illumination maps: https://data.lroc.im-ldi.com/lroc/view_rdr/WAC_POLE_ILL_TWI_SOUTH and https://data.lroc.im-ldi.com/lroc/view_rdr/WAC_POLE_ILL_PCT_SOUTH
- Lunar QuickMap for browsing: https://quickmap.lroc.asu.edu

### 8.7 Skip this weekend
DEM clones, XYZI point clouds, LDEC count maps, uncertainty maps, Diviner, neutron spectrometer data, shape from shading DEMs, deep learning topography, anything found via data.nasa.gov search.

### 8.8 Site coordinates (collect by hand, record a source for each)
- Apollo 11, 12, 14, 15, 16, 17 from the NSSDC.
- Recent landers: IM-1, IM-2, Blue Ghost 1, Chandrayaan-3, SLIM, Chang'e 3, 4, 5, 6.
- Artemis III candidate regions.

---

## 9. Setup on a fresh machine

```bash
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install numpy rasterio pyproj spiceypy astroquery matplotlib
```

`spiceypy` must be version 6 or newer for `azlcpo`.

### Check the downloads (practice task, allowed now)
Write a short script in `study/` that:
1. Opens each `raw/dem/*_surf.tif` with rasterio and prints shape, pixel size, CRS, and min/max height. Expect 5 m pixels, a south polar stereographic CRS, heights in the thousands of metres (can be negative).
2. Loads the five kernels and prints the Sun's and Earth's distance from the Moon for one date. Expect about 1 AU (about $1.5\times10^8$ km) and about 384 000 km.

---

## 10. Practice tasks before Saturday (all in `study/`, all deleted after)

1. Download check (section 9).
2. Horizon study: compute one horizon mask on Site01 at the highest central point, plot it.
3. SPICE study: Sun and Earth az/el at one Site01 point for 60 days, three ways (our vector maths, SPICE `azlcpo`, JPL Horizons), print max differences.
4. Combine 2 and 3 for 2024 to 2025 and compare sunlit % and longest night with Barker et al.
5. Speed test: time one horizon mask, then a 40 by 40 grid. Decide grid spacing for Saturday.
6. Far field test: does adding the mosaic change Site01 sunlit % by more than a couple of percent?

Record anything learned (conventions, gotchas, timings) in section 12 below so Saturday's build uses it.

---

## 11. Saturday build order

| Time | Data (Haruki) | Frontend | Pitch |
|---|---|---|---|
| 09:00 to 10:00 | repo, branches, dummy data files committed | page skeleton loading dummy files | read Resources tab, project page outline |
| 10:00 to 13:00 | horizon for one point, then ephemeris file | sky view and timeline on dummy data | storyboard, collect site coordinates |
| 13:00 to 16:00 | Horizons check, Site01 validation | metrics panel, site picker | **milestone: one real site end to end** |
| 16:00 to 20:00 | horizon grids for all sites, sites.json | compare view, deploy | first user test, list confusing bits |
| Sat night | far field mosaic if time allows | | |
| Sun 09:00 to 12:00 | validation plot, should-haves | should-haves, fixes | video storyboard final |
| Sun 12:00 | **feature freeze** | | |
| Sun afternoon | | | record video, rehearse pitch twice, fill project page |
| Sun before 23:59 | **submit**, open every link logged out and on a phone | | |

### Fallbacks
- Horizon grids too slow: one point per site (ROI centre).
- Mosaic not processed: site tiles only; say results are slightly optimistic.
- SPICE fails: build the ephemeris from JPL Horizons at the Moon centre.
- Frontend behind: drop map and next window; keep sky view, timeline, metrics, compare.
- Hosting fails: run locally, keep a screen recording as backup.

---

## 12. Notes and findings (update as we go)

- PGDA homepage does not link product 78 directly; use the URL.
- Site23 has no ROI shapefile on the PGDA page.
- `de421.bsp` is no longer at `spk/planets/`; that path returns 404. It is at `https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/a_old_versions/de421.bsp` (16.8 MB). The other four kernel URLs in 8.2 work.
- Direct DEM URLs follow `https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/<Site>/<filename>`; the README is `https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/README`. Sizes: Site01/04/11 are 41 MB per file, Site23 is 71 MB per file.
- The PGDA server reset one connection mid download (Site23 surf). Compare file sizes against the server's Content-Length; `curl -C -` resumes.
- PGDA README: X/Y are pixel centres (GMT pixel registered convention).
- This laptop (12 Nov): Windows, Python 3.9.13, `.venv` with numpy 1.26.4, rasterio 1.4.3, pyproj 3.6.1, spiceypy 6.0.0, astroquery 0.4.11, matplotlib 3.9.4. Run scripts with `.venv\Scripts\python`.
- DEM facts (checked 13 Nov): Site01/04/11 are 3200 x 3200 px (16 km), Site23 is 4200 x 4200 (21 km). CRS is `+proj=stere +lat_0=-90 +lon_0=0 +R=1737400`. Nodata is NaN, so use `nanmax`/`nanargmax`.
- Grid convention confirmed numerically on Site01: lon = atan2(x, y), north points away from the pole, east is 90 degrees clockwise of north on the map as plotted (x right, y up).
- Site01 highest central point: lat -89.4389, lon -137.1436, ground 1959.5 m (pixel row 1694, col 1485). Tile-only horizon at 1 m: min -3.65, max -0.47, mean -2.12 degrees; no azimuth above 0.
- Tile-only horizons from a summit fall below the smooth sphere dip, $-\sqrt{2h_0/R}$ (-2.72 degrees at 1960 m), in some directions. That cannot be real, so it marks where far field terrain is missing. Rays leave the Site01 tile after 7 to 12 km; the sphere horizon from that height is 82 km away.
- Az/el check (13 Nov, Site01 high point, hourly, 60 days from 1 Jan 2024): our vector maths vs `azlcpo` agrees to 0.00003 degrees (0.1 arcsec, Earth elevation; Sun identical). Ours vs JPL Horizons agrees to 0.00003 degrees in elevation and 0.000002 in azimuth. Much better than the "few hundredths" expected, so no frame, time or sign problem.
- Working calls: `spice.azlcpo("ELLIPSOID", target, et, "LT+S", False, True, site_km, "MOON", "MOON_ME")` returns (state, lt) with state[1] = az, state[2] = el in radians. Horizons: `Horizons(id="10" or "399", location={"lon", "lat", "elevation" (km), "body": 301}, epochs={start, stop, step})`, then `.ephemerides(quantities="4")`, columns `AZ`, `EL`, `datetime_jd`. East positive longitude, azimuth clockwise from north, times UTC.
- At the Site01 high point, Earth stays at azimuth 129 to 144 degrees and swings from -7.2 to +6.0 degrees elevation; it is above the flat horizon 50% of the time. Earth parallax is up to 0.28 degrees, Sun 0.0007.
- Barker et al. (2021) details for validation: Site 1 RoI 1 centroid is X = -11.5825 km, Y = -12.4625 km (14 m from the Site01 high point). Table 2 gives clone percentiles, not single-pixel values: at 1 m, average illumination 68.0% (RoI average) to 85.8% (best pixel each hour), LCSP 16.6 to 10.5 days, LCIP 63 to 205 days; at 5 m, 89.3 to 91.8%, LCSP 5.3 to 3.7 days, LCIP 216 to 233 days. LCSP = longest run with no Sun visible at all, LCIP = longest run with any Sun visible. Their method: 720 azimuths, 5 m DEM to 5 km, 80 m from 5 to 100 km, 240 m beyond, hourly, limb darkening.
- Our tile-only result (13 Nov), 1 Jan 2024 to 1 Jan 2026, hourly. High point, 1 m: sunlit 87.9%, LCSP 9.96 d, LCIP 205.3 d, Earth visible 59.1%. High point, 5 m: 95.6%, 3.67 d, 235.1 d, Earth 65.0%. RoI 1 centroid, 1 m: 82.1%, 12.1 d, 147.3 d. RoI 1 centroid, 5 m: 94.3%, 3.92 d, 234.9 d. LCSP and LCIP match Barker's best-pixel values closely; sunlit % is 2 to 4 points higher, as expected without far field terrain.
- From a 1960 m summit the Sun stays visible down to about -2 degrees elevation, so "Sun above 0 degrees" is the wrong test at ridge sites.
- Timing: four horizon masks plus two years of hourly SPICE positions for Sun and Earth ran in 4 s in total.
- Speed test (13 Nov, Site01, tile only, this laptop). One point, 360 azimuths, both masts: 190 ms with uniform 5 m ray steps; 40 ms with 5 m steps to 1 km then steps of 0.5% of distance (max error 0.08 degrees, mean 0.002); 19 ms with 1% steps (max error 0.11). A 40 x 40 grid took 54 s with the 0.5% scheme and would take 290 s with uniform steps. Sunlit % for 1600 points x 2 masts x 2 years took 10 s.
- File size for 1600 points x 2 masts x 360 int16: 2.30 MB raw, 3.07 MB base64, 1.82 MB base64 after gzip. So 40 x 40 is the most one file can hold near the 2 MB target. A whole 16 km tile fits only at 400 m spacing (1600 points).
- Grid spacing finding: at 1 m mast, sunlit % changes by a median of 2.8 points and a 90th percentile of 13 points between neighbours 100 m apart, and only 6 of 1600 points in the 4 km square exceed 70%. The well lit patches are smaller than 100 m (Barker RoI 1 is 8625 m2), so a 100 m grid mostly misses them and snapping a custom point to it can mislead. At 5 m mast the ridge is a continuous band (65 points above 70%). Plan: exact masks at named points (RoI centroids) as the main sites, plus a grid for the map.
- Mosaic `raw/mosaic/ldem_87s_5mpp.tif` downloaded and size-verified (3,465,285,714 bytes). It is 40000 x 40000 px at 5 m (200 km square), float32, NaN nodata, deflate compressed, same CRS as the site tiles. It has built-in overviews at 2, 4, 8, 16, 32, 64, 128 and 255 times, so an 80 m version (16x) can be read directly without decompressing the full file. The PGDA server drops long downloads; use `curl -C -` in a retry loop with a pause.
- Practice task 6 (far field test) was written but never run before the event started.
- `spice.str2et` rejects ISO "T" strings with a trailing " UTC"; pass `2027-01-01T00:00:00` alone (ISO is read as UTC).
- Step 1 check (14 Nov, `python -m pipeline.validate horizons`, Site01 high point, 1440 h from 1 Jan 2027): max differences vs azlcpo 0.000026 deg, vs Horizons 0.000033 deg. Sun el -0.80 to 1.53 deg, Earth el -7.55 to 6.19 deg, Earth angular radius 0.90 to 1.02 deg.
- Step 2 check (14 Nov). Synthetic flat map with blocks: `horizon.py` matches the hand formula to 0.0002 deg (the gap is the small-angle approximation in the hand formula; the code uses the exact sphere form). Site01 high point, tile only, 720 rays in 5 m steps, 1.5 s for both masts: 1 m min -3.66, max -0.45 (az 184.5), mean -2.14; 5 m min -4.84, max -0.87, mean -3.15. Below the sphere dip in 39% (1 m) and 67% (5 m) of directions, so the far field is missing there.
- On a summit the 5 m horizon is lower than the 1 m one everywhere, by up to about 1.5 deg. At 1 m the highest angles come from the summit's own shoulders tens of metres away; a 4 m higher mast looks over them. The two curves meet where a distant ridge sets the horizon (az 70 to 80).
- Step 3 (14 Nov). `visibility.py` slices each disc into 64 vertical strips so a horizon that slopes across Earth's 2 deg disc is handled; on a flat horizon it matches the section 2 closed form to 0.0009. Rerunning the practice case (high point, 2024 to 2025) gives the same numbers to 0.1 point. Plane-fit slope over 5 x 5 px vs PGDA slope map: median gap 0.27 deg, correlation 0.985.
- Site01 entry uses the Barker RoI 1 centroid (x -11582.5, y -12462.5). 2027, tile only: 1 m sunlit 83.7%, longest dark 12.5 d, Earth 57.1%, both 48.3%; 5 m sunlit 94.7%, longest dark 4.5 d, Earth 62.6%, both 60.6%. File is 0.41 MB per site.
- Rounded azimuths can hit 360.00; `build.py` wraps them to [0, 360).
- Step 4 instructions from Haruki: do not clamp horizons at the sphere dip; use real mosaic heights (terrain can lie below the reference radius). Check whether terrain beyond the mosaic edge (north of 87 S) can set the horizon, e.g. Malapert massif (about 5 km high, about 130 km away, near the Earth direction). If so, propose the LOLA 240 m polar DEM (75 to 90 S) as a third tier and report before downloading anything.
- (add more here)

---

## 13. Still to confirm

- Challenge Resources tab (opens 13 Nov): add anything new to section 8
- 2026 Submission Guide and Judging Guide (13 Nov): project page fields, demo format and length
- London event times, venue, and live pitch format
- Team members for frontend and pitch roles
