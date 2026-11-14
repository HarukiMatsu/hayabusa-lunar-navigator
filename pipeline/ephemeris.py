"""Sun and Earth azimuth, elevation and angular radius at a lunar site.

Positions come from the SPICE kernels in kernels/ (DE421, MOON_ME frame, the
same frame as the PGDA elevation maps). The topocentric maths follows
CLAUDE.md section 2:

    u = (cos(lat) cos(lon), cos(lat) sin(lon), sin(lat))   local up
    e = (-sin(lon), cos(lon), 0)                           local east
    n = (-sin(lat) cos(lon), -sin(lat) sin(lon), cos(lat)) local north

    v  = B - r u          body position seen from the site (r = R + height)
    az = atan2(v.e, v.n)  clockwise from north
    el = asin(v.u / |v|)  above the local horizontal plane
"""
from pathlib import Path

import numpy as np
import spiceypy as spice

ROOT = Path(__file__).resolve().parents[1]
KERNEL_DIR = ROOT / "kernels"
KERNELS = [
    "naif0012.tls",
    "pck00010.tpc",
    "de421.bsp",
    "moon_pa_de421_1900-2050.bpc",
    "moon_080317.tf",
]
MOON_R_KM = 1737.4  # reference sphere of the PGDA elevation maps

_loaded = False


def load_kernels():
    global _loaded
    if not _loaded:
        for k in KERNELS:
            spice.furnsh(str(KERNEL_DIR / k))
        _loaded = True


def body_radius_km(name):
    """Mean equatorial radius from pck00010 (Sun 696000 km, Earth 6378.1 km)."""
    load_kernels()
    return float(spice.bodvrd(name, "RADII", 3)[1][0])


def hourly_ets(start_utc, n_steps, step_hours=1):
    """Ephemeris times (TDB seconds past J2000) for an evenly spaced UTC grid."""
    load_kernels()
    et0 = spice.str2et(start_utc.replace("Z", ""))  # ISO strings are read as UTC
    # UTC and TDB tick at the same rate apart from leap seconds; none are
    # scheduled in 2024 to 2030, so a fixed offset grid is exact here.
    return et0 + np.arange(n_steps) * step_hours * 3600.0


def body_positions(ets, target):
    """Moon centred position of a body in MOON_ME, km, shape (n, 3).

    Light time and stellar aberration corrected (LT+S), as an observer at the
    Moon would see it.
    """
    load_kernels()
    pos, _ = spice.spkpos(target, np.asarray(ets), "MOON_ME", "LT+S", "MOON")
    return np.atleast_2d(np.asarray(pos))


def local_frame(lat_deg, lon_deg):
    lat, lon = np.radians(lat_deg), np.radians(lon_deg)
    u = np.array([np.cos(lat) * np.cos(lon), np.cos(lat) * np.sin(lon), np.sin(lat)])
    e = np.array([-np.sin(lon), np.cos(lon), 0.0])
    n = np.array([-np.sin(lat) * np.cos(lon), -np.sin(lat) * np.sin(lon), np.cos(lat)])
    return u, e, n


def az_el(body_km, lat_deg, lon_deg, height_m):
    """Azimuth and elevation (degrees) and distance (km) of a body from a site.

    height_m is the observer height above the 1737.4 km sphere (ground + mast).
    """
    u, e, n = local_frame(lat_deg, lon_deg)
    r = MOON_R_KM + height_m / 1000.0
    v = body_km - r * u
    dist = np.linalg.norm(v, axis=1)
    az = np.degrees(np.arctan2(v @ e, v @ n)) % 360.0
    el = np.degrees(np.arcsin((v @ u) / dist))
    return az, el, dist


def angular_radius_deg(dist_km, radius_km):
    return np.degrees(np.arcsin(radius_km / dist_km))


def site_sky(lat_deg, lon_deg, height_m, ets, sun_km=None, earth_km=None):
    """Sun and Earth az, el, angular radius for one site over a time grid.

    Pass precomputed Moon centred positions to reuse them across sites; the
    site offset (parallax) is applied here, so one set serves every site.
    """
    if sun_km is None:
        sun_km = body_positions(ets, "SUN")
    if earth_km is None:
        earth_km = body_positions(ets, "EARTH")
    s_az, s_el, s_d = az_el(sun_km, lat_deg, lon_deg, height_m)
    e_az, e_el, e_d = az_el(earth_km, lat_deg, lon_deg, height_m)
    return {
        "sun_az": s_az,
        "sun_el": s_el,
        "sun_rad": angular_radius_deg(s_d, body_radius_km("SUN")),
        "earth_az": e_az,
        "earth_el": e_el,
        "earth_rad": angular_radius_deg(e_d, body_radius_km("EARTH")),
    }
