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


if __name__ == "__main__":
    what = sys.argv[1] if len(sys.argv) > 1 else "horizons"
    if what == "horizons":
        check_horizons()
    else:
        sys.exit(f"unknown check: {what}")
