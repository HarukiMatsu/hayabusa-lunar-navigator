"""Run every stage and write web/data/visibility.json (data contract in
CLAUDE.md section 5). Run from the project root:

    .venv\\Scripts\\python -m pipeline.build
"""
import json
import time
from pathlib import Path

import numpy as np

from pipeline import ephemeris as eph
from pipeline import horizon as hz
from pipeline import visibility as vis
from pipeline.terrain import mosaic_dem, polar_dem, site_dem

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "web" / "data" / "visibility.json"

START_UTC = "2027-01-01T00:00:00Z"
STEP_HOURS = 1
N_STEPS = 8760  # 365 days

MASTS = (1.0, 5.0)


def far_tiers():
    """Far field beyond each site map, nearest first:
    1. the 87-90 S mosaic at 80 m (40 m gave the same numbers to 0.1 point),
       sampled every 40 m out to its edge (about 74 to 126 km from Site01);
    2. LOLA LDEM_75S_240M, sampled every 120 m from the mosaic edge to 300 km.
       From a 5.2 km summit a 7 km peak drops below the smooth sphere edge
       by about 290 km, so nothing beyond 300 km can set a horizon."""
    return [(mosaic_dem(16), 40.0, 150000.0), (polar_dem(), 120.0, 300000.0)]

# Each site is a single point on its PGDA map, given in map metres.
# Where Barker et al. (2021) give regions of interest (RoIs, regions with
# average illumination over 70% at 1 m), we use RoI 1's reference point from
# the RoI shapefile table (raw/dem/<site>_ROIs.tgz; terrain.read_rois).
# Site23 has no RoIs; we use the Malapert summit, the highest pixel in the
# tile (5173.6 m). The tile centre sits on the massif's flank below a small
# crest and gets only 15% sunlit at 1 m, so it does not represent the site.
SITES = [
    {"id": "site01", "name": "Site01 Connecting ridge", "dem": "Site01",
     "x": -11582.5, "y": -12462.5,
     "source": "Barker et al. (2021), Site 1 RoI 1"},
    {"id": "site04", "name": "Site04 Shackleton rim", "dem": "Site04",
     "x": -2812.5, "y": -6647.5,
     "source": "Barker et al. (2021), Site 4 RoI 1"},
    {"id": "site11", "name": "Site11 de Gerlache rim", "dem": "Site11",
     "x": -37542.5, "y": 14882.5,
     "source": "Barker et al. (2021), Site 11 RoI 1"},
    {"id": "site23", "name": "Site23 Malapert massif", "dem": "Site23",
     "x": 4392.5, "y": 121637.5,
     "source": "Highest point of PGDA Site23 tile (Malapert summit)"},
]
TIER_NAMES = ("tile", "mosaic", "polar")


def r2(a):
    return np.round(np.asarray(a, float), 2).tolist()


def az2(a):
    """Round an azimuth to 2 decimals and keep it in [0, 360)."""
    return (np.round(np.asarray(a, float), 2) % 360.0).tolist()


def build_site(site, ets, sun_km, earth_km):
    dem = site_dem(site["dem"])
    x, y = site["x"], site["y"]
    lat, lon = dem.latlon(x, y)
    ground, hor, src = hz.site_horizon(dem, x, y, masts_m=MASTS, far=far_tiers(), with_source=True)
    slope, facing = dem.slope(x, y)
    sky = eph.site_sky(lat, lon, ground + MASTS[0], ets, sun_km, earth_km)

    frac = {}
    for mast in MASTS:
        frac[mast] = (
            vis.disc_fraction(hor[mast], sky["sun_az"], sky["sun_el"], sky["sun_rad"]),
            vis.disc_fraction(hor[mast], sky["earth_az"], sky["earth_el"], sky["earth_rad"]),
        )

    entry = {
        "id": site["id"], "name": site["name"],
        "lat": round(float(lat), 4), "lon": round(float(lon), 4),
        "height_m": round(ground, 2),
        "slope_deg": round(slope, 2), "slope_facing_deg": round(facing, 2),
        "sun": r2(frac[1.0][0]), "earth": r2(frac[1.0][1]),
        "sun_5m": r2(frac[5.0][0]), "earth_5m": r2(frac[5.0][1]),
        "sun_az": az2(sky["sun_az"]), "sun_el": r2(sky["sun_el"]),
        "earth_az": az2(sky["earth_az"]), "earth_el": r2(sky["earth_el"]),
        "horizon": r2(hor[1.0]), "horizon_5m": r2(hor[5.0]),
        "ground_temp_k": [None] * len(ets),  # filled in step 6 (thermal.py)
    }
    stats = {m: vis.summary(*frac[m], STEP_HOURS) for m in MASTS}
    for m in MASTS:
        stats[m]["tiers"] = ", ".join(f"{n} {int(np.sum(src[m] == k))}" for k, n in enumerate(TIER_NAMES))
        stats[m]["no_terrain"] = int(np.sum(hor[m] == hz.NO_TERRAIN))
    return entry, stats


def main():
    t0 = time.perf_counter()
    ets = eph.hourly_ets(START_UTC, N_STEPS, STEP_HOURS)
    sun_km = eph.body_positions(ets, "SUN")
    earth_km = eph.body_positions(ets, "EARTH")
    sites = []
    for s in SITES:
        entry, stats = build_site(s, ets, sun_km, earth_km)
        sites.append(entry)
        print(f"{entry['id']}: lat {entry['lat']}, lon {entry['lon']}, ground {entry['height_m']} m, "
              f"slope {entry['slope_deg']} deg facing {entry['slope_facing_deg']} deg")
        for m, st in stats.items():
            print(f"  {m:.0f} m mast: sunlit {st['sunlit_pct']:.1f}%, "
                  f"longest dark {st['longest_dark_h'] / 24:.1f} d, "
                  f"longest no Sun {st['longest_no_sun_h'] / 24:.1f} d, "
                  f"Earth visible {st['earth_pct']:.1f}%, "
                  f"longest blackout {st['longest_blackout_h'] / 24:.1f} d, "
                  f"both {st['both_pct']:.1f}%")
            print(f"           azimuths set by {st['tiers']}; no terrain {st['no_terrain']}")

    data = {"meta": {"start_utc": START_UTC, "step_hours": STEP_HOURS, "n_steps": N_STEPS},
            "sites": sites}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, separators=(",", ":"), allow_nan=False))
    print(f"\nwrote {OUT.relative_to(ROOT)}, {OUT.stat().st_size / 1e6:.2f} MB, "
          f"{time.perf_counter() - t0:.1f} s")


if __name__ == "__main__":
    main()
