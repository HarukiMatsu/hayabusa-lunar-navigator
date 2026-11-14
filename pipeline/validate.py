"""Validation checks. Run from the project root:

    .venv\\Scripts\\python -m pipeline.validate horizons
"""
import sys

import numpy as np
import spiceypy as spice

from pipeline import ephemeris as eph

# Site01 high point (CLAUDE.md section 12), 1 m mast
SITE01_HIGH = {"lat": -89.4389, "lon": -137.1436, "ground_m": 1959.5}


def wrap180(d):
    return (np.asarray(d) + 180.0) % 360.0 - 180.0


def check_horizons(start="2027-01-01T00:00:00Z", days=60):
    """Compare our Sun and Earth az/el with SPICE azlcpo and with JPL Horizons."""
    from astroquery.jplhorizons import Horizons

    s = SITE01_HIGH
    h_m = s["ground_m"] + 1.0
    n = days * 24
    ets = eph.hourly_ets(start, n)
    sky = eph.site_sky(s["lat"], s["lon"], h_m, ets)

    # 1. SPICE's own topocentric routine, same kernels, independent code path
    site_km = spice.latrec(eph.MOON_R_KM + h_m / 1000.0,
                           np.radians(s["lon"]), np.radians(s["lat"]))
    spice_ref = {}
    for key, tgt in (("sun", "SUN"), ("earth", "EARTH")):
        az = np.empty(n)
        el = np.empty(n)
        for i, et in enumerate(ets):
            st, _ = spice.azlcpo("ELLIPSOID", tgt, et, "LT+S", False, True,
                                 site_km, "MOON", "MOON_ME")
            az[i], el[i] = np.degrees(st[1]), np.degrees(st[2])
        spice_ref[key] = (az, el)

    # 2. JPL Horizons, independent ephemeris (DE440/441) and software
    stop = np.datetime64(start.replace("Z", "")) + np.timedelta64(days, "D")
    loc = {"lon": s["lon"], "lat": s["lat"], "elevation": h_m / 1000.0, "body": 301}
    hz = {}
    for key, tgt in (("sun", "10"), ("earth", "399")):
        tab = Horizons(id=tgt, location=loc,
                       epochs={"start": start[:16].replace("T", " "),
                               "stop": str(stop)[:16].replace("T", " "),
                               "step": "1h"}).ephemerides(quantities="4")
        hz[key] = (np.asarray(tab["AZ"], float)[:n], np.asarray(tab["EL"], float)[:n])

    print(f"Site01 high point, lat {s['lat']}, lon {s['lon']}, "
          f"height {h_m} m, {n} hourly samples from {start}\n")
    print(f"{'body':6} {'reference':10} {'max |d az| deg':>15} {'max |d el| deg':>15}")
    for key in ("sun", "earth"):
        for name, ref in (("azlcpo", spice_ref[key]), ("Horizons", hz[key])):
            daz = np.max(np.abs(wrap180(sky[key + "_az"] - ref[0])))
            dele = np.max(np.abs(sky[key + "_el"] - ref[1]))
            print(f"{key:6} {name:10} {daz:15.6f} {dele:15.6f}")
    print()
    for key in ("sun", "earth"):
        print(f"{key}: el {sky[key+'_el'].min():.2f} to {sky[key+'_el'].max():.2f} deg, "
              f"az {sky[key+'_az'].min():.1f} to {sky[key+'_az'].max():.1f} deg, "
              f"angular radius {sky[key+'_rad'].min():.3f} to {sky[key+'_rad'].max():.3f} deg")


def check_horizon_synthetic():
    """Flat ground with two blocks of known size; compare with hand values."""
    from pyproj import CRS
    from pipeline import horizon as hz
    from pipeline.terrain import Dem

    crs = CRS.from_proj4("+proj=stere +lat_0=-90 +lon_0=0 +R=1737400 +units=m")
    res, half = 5.0, 1000                       # 2001 x 2001 px, 10 km square
    probe = Dem(np.zeros((1, 1)), 0, 0, 1, crs.to_wkt())
    xc, yc = probe.xy(-89.0, 0.0)               # x = 0, y about 30 km
    xs = xc + (np.arange(2 * half + 1) - half) * res
    ys = yc - (np.arange(2 * half + 1) - half) * res
    X, Y = np.meshgrid(xs - xc, ys - yc)
    z = np.zeros_like(X)
    z[(Y >= 2000) & (Y <= 2200) & (np.abs(X) <= 500)] = 100.0   # block 2 km north, 100 m tall
    z[(X >= 3000) & (X <= 3100) & (np.abs(Y) <= 300)] = 50.0    # block 3 km east, 50 m tall
    dem = Dem(z, xs[0] - res / 2, ys[0] + res / 2, res, crs.to_wkt())

    mast = 1.0
    _, out = hz.horizon(dem, xc, yc, masts_m=(mast,))
    h = out[mast]
    R = 1737400.0

    def hand(height, d):  # CLAUDE.md section 2 formula
        return np.degrees(np.arctan((height - mast - d ** 2 / (2 * R)) / d))

    rows = [("north block (az 0)", 0.0, hand(100, 2000)),
            ("east block (az 90)", 90.0, hand(50, 3000)),
            ("flat ground (az 45)", 45.0, hz.sphere_dip_deg(mast)),
            ("flat ground (az 225)", 225.0, hz.sphere_dip_deg(mast))]
    print("Synthetic DEM: flat ground, 1 m mast, observer at 89 S 0 E\n")
    print(f"{'direction':22} {'expected deg':>13} {'computed deg':>13} {'diff deg':>10}")
    for name, az, exp in rows:
        got = h[int(round(az / hz.AZ_STEP))]
        print(f"{name:22} {exp:13.5f} {got:13.5f} {got - exp:10.5f}")


def check_horizon_site01(plot=True):
    """Near field horizon at the Site01 high point, 1 m and 5 m masts."""
    import time
    from pipeline import horizon as hz
    from pipeline.terrain import site_dem

    s = SITE01_HIGH
    dem = site_dem("Site01")
    x, y = dem.xy(s["lat"], s["lon"])
    t = time.perf_counter()
    ground, out = hz.horizon(dem, x, y, masts_m=(1.0, 5.0))
    dt = time.perf_counter() - t
    print(f"Site01 high point: map x {x:.1f} m, y {y:.1f} m, ground {ground:.1f} m "
          f"(listed 1959.5 m); 720 rays, 5 m steps, {dt:.2f} s\n")
    print(f"{'mast':>5} {'min':>7} {'max':>7} {'mean':>7} {'az of max':>10} "
          f"{'sphere dip':>11} {'% below dip':>12} {'no data':>8}")
    for mast, h in out.items():
        dip = hz.sphere_dip_deg(ground + mast)
        print(f"{mast:4.0f}m {h.min():7.2f} {h.max():7.2f} {h.mean():7.2f} "
              f"{hz.AZ[np.argmax(h)]:10.1f} {dip:11.2f} "
              f"{100 * np.mean(h < dip):11.1f}% {np.sum(h == hz.NO_TERRAIN):8d}")

    if plot:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        from pathlib import Path
        out_png = Path(__file__).resolve().parents[1] / "docs" / "validation" / "horizon_site01_nearfield.png"
        out_png.parent.mkdir(parents=True, exist_ok=True)
        fig, ax = plt.subplots(figsize=(10, 4), dpi=150)
        fig.patch.set_facecolor("#fcfcfb")
        ax.set_facecolor("#fcfcfb")
        ax.axvspan(129, 145, color="#c3c2b7", alpha=0.35, lw=0)
        ax.text(137, 1.3, "Earth directions", ha="center", fontsize=8, color="#52514e")
        ax.axhspan(-1.6, 1.6, color="#eda100", alpha=0.08, lw=0)
        ax.text(2, 1.3, "Sun elevation range", fontsize=8, color="#52514e")
        ax.axhline(hz.sphere_dip_deg(ground + 1), color="#52514e", lw=1, ls="--")
        ax.text(214, hz.sphere_dip_deg(ground + 1) - 0.2, "smooth sphere edge", ha="center",
                fontsize=8, color="#52514e")
        ax.plot(hz.AZ, out[1.0], color="#2a78d6", lw=2, label="1 m mast")
        ax.plot(hz.AZ, out[5.0], color="#eb6834", lw=2, label="5 m mast")
        ax.set_xlim(0, 360)
        ax.set_xticks(range(0, 361, 45))
        ax.set_xlabel("Azimuth, degrees clockwise from north")
        ax.set_ylabel("Horizon elevation, degrees")
        ax.set_title("Site01 high point, terrain horizon from the 16 km site map only",
                     loc="left", fontsize=11)
        ax.grid(color="#e4e3df", lw=0.6)
        for side in ("top", "right"):
            ax.spines[side].set_visible(False)
        ax.legend(frameon=False, loc="upper right", ncol=2)
        fig.tight_layout()
        fig.savefig(out_png)
        print(f"\nplot: {out_png.relative_to(out_png.parents[2])}")


CHECKS = {
    "horizons": check_horizons,
    "horizon-synthetic": check_horizon_synthetic,
    "horizon-site01": check_horizon_site01,
}

if __name__ == "__main__":
    what = sys.argv[1] if len(sys.argv) > 1 else "horizons"
    if what not in CHECKS:
        sys.exit(f"unknown check: {what}; choose from {', '.join(CHECKS)}")
    CHECKS[what]()
