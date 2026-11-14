# Lunar Landing Site Navigator

Team Hayabusa, NASA Space Apps Challenge 2026 (London).

Pick a lunar landing site and a date and see, hour by hour, whether the Sun and Earth are above the local terrain horizon. That tells you when a lander has solar power and when it can talk directly to Earth, so you can compare sites and dates quickly, for example after a launch slips.

## What it computes

For each site, hourly through 2027:

- Sun and Earth azimuth and elevation, from NASA/JPL SPICE ephemerides (DE421, MOON_ME frame)
- the terrain horizon in 720 directions, from LOLA elevation maps out to 300 km
- the fraction of the Sun's disc and of Earth's disc above that horizon, for a 1 m and a 5 m mast
- a simple ground temperature estimate

Sites: Site01 (connecting ridge), Site04 (Shackleton rim), Site11 (de Gerlache rim) and Site23 (Malapert massif).

The Python pipeline writes everything to one file, `web/data/visibility.json`, which the web app reads. The data format is described in section 5 of `CLAUDE.md`.

## Results are checked

Our numbers are compared with JPL Horizons, with hand calculations, with the published illumination results of Barker et al. (2021) and with Diviner equatorial temperatures. See [docs/validation/summary.md](docs/validation/summary.md) for the table and plots.

## Running the pipeline

Tested with Python 3.9 on Windows.

```bash
python -m venv .venv
.venv\Scripts\activate            # macOS or Linux: source .venv/bin/activate
pip install numpy rasterio pyproj spiceypy astroquery matplotlib
```

Download the data into these folders (they are not in git):

| Folder | Files | Source |
|---|---|---|
| `kernels/` | `naif0012.tls`, `pck00010.tpc`, `de421.bsp`, `moon_pa_de421_1900-2050.bpc`, `moon_080317.tf` | https://naif.jpl.nasa.gov/pub/naif/generic_kernels/ (`de421.bsp` is under `spk/planets/a_old_versions/`) |
| `raw/dem/` | `SiteNN_final_adj_5mpp_surf.tif` for Site01, Site04, Site11, Site23 | https://pgda.gsfc.nasa.gov/products/78 |
| `raw/mosaic/` | `ldem_87s_5mpp.tif` | https://pgda.gsfc.nasa.gov/products/81 |
| `raw/polar/` | `ldem_75s_240m.img` and `ldem_75s_240m.lbl` | https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/ |

Then, from the project root:

```bash
python -m pipeline.build       # writes web/data/visibility.json (about 20 s)
python -m pipeline.validate    # writes docs/validation/ (needs internet for JPL Horizons)
```

## Data sources

- High resolution LOLA elevation maps of south pole sites, Barker et al. (2021), NASA GSFC Planetary Geodesy Data Archive
- LOLA 5 m south pole mosaic (87 to 90 degrees S), NASA GSFC Planetary Geodesy Data Archive
- LOLA polar topography LDEM_75S_240M, NASA Planetary Data System
- NAIF SPICE kernels, NASA/JPL
- JPL Horizons (validation only)

Full citations, including the papers behind the thermal model, are in [docs/references.md](docs/references.md). How we used AI tools is recorded in [docs/ai_use.md](docs/ai_use.md).

## Licence

MIT, see [LICENSE](LICENSE).
