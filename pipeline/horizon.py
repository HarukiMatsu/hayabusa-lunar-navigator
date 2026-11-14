"""Terrain horizon: the elevation angle of the highest terrain in each of 720
directions (0.5 degree steps, clockwise from local north).

For terrain at surface distance d with height h, seen from observer height
h0 (ground + mast), both measured above the sphere of radius R, the
elevation angle on a spherical Moon is

    gamma = d / R
    el    = atan2((R + h) cos(gamma) - (R + h0), (R + h) sin(gamma))

For d << R this is atan((h - h0 - d^2 / 2R) / d), the formula in CLAUDE.md
section 2; the exact form is used so it stays right out to 100+ km.

Rays follow great circles on the sphere (computed in 3D, then projected onto
each map), so the direction stays true at any distance. Heights come from a
list of tiers, nearest first; each tier is used from where the previous one
runs out of data along that ray. Nothing is clamped: terrain below the
reference sphere is used as it is.
"""
import numpy as np

from pipeline.terrain import Dem

R_M = 1737400.0
N_AZ = 720
AZ_STEP = 0.5
AZ = np.arange(N_AZ) * AZ_STEP
NO_TERRAIN = -90.0  # value for a direction where no terrain sample exists


def elevation_angle(d_m, h_m, h0_m):
    g = d_m / R_M
    return np.degrees(np.arctan2((R_M + h_m) * np.cos(g) - (R_M + h0_m),
                                 (R_M + h_m) * np.sin(g)))


def ray_latlon(lat_deg, lon_deg, d_m):
    """Lat/lon of points at surface distance d along all 720 great circles.
    Shapes (720, len(d))."""
    lat, lon = np.radians(lat_deg), np.radians(lon_deg)
    u = np.array([np.cos(lat) * np.cos(lon), np.cos(lat) * np.sin(lon), np.sin(lat)])
    e = np.array([-np.sin(lon), np.cos(lon), 0.0])
    n = np.array([-np.sin(lat) * np.cos(lon), -np.sin(lat) * np.sin(lon), np.cos(lat)])
    a = np.radians(AZ)[:, None, None]
    g = (np.asarray(d_m) / R_M)[None, :, None]
    dirv = np.cos(a) * n + np.sin(a) * e                      # (720, 1, 3)
    p = np.cos(g) * u + np.sin(g) * dirv                      # (720, nd, 3)
    return (np.degrees(np.arcsin(np.clip(p[..., 2], -1, 1))),
            np.degrees(np.arctan2(p[..., 1], p[..., 0])))


def tier_heights(dem: Dem, lat_deg, lon_deg, d_m):
    plat, plon = ray_latlon(lat_deg, lon_deg, d_m)
    x, y = dem.xy(plat, plon)
    return dem.height(np.asarray(x), np.asarray(y))


def horizon(tiers, lat_deg, lon_deg, ground_m, masts_m=(1.0, 5.0), with_source=False):
    """Horizon for each mast height.

    tiers: list of (dem, step_m, max_m) or (dem, step_m, max_m, min_m),
    nearest first (finest first). A sample from tier k is used only where no
    earlier tier has data at that point, so a coarser map fills every gap in
    the finer ones, including gaps between them (e.g. between the Site23
    tile and the mosaic).

    Returns {mast: 720 angles in degrees}; with_source=True also returns
    {mast: index of the tier that set the horizon in each direction}.
    """
    best = {m: np.full(N_AZ, -np.inf) for m in masts_m}
    src = {m: np.full(N_AZ, -1) for m in masts_m}
    spans = []
    for k, tier in enumerate(tiers):
        dem, step, max_m = tier[:3]
        min_m = tier[3] if len(tier) > 3 else 0.0
        d = np.arange(min_m + step, max_m + step, step)
        plat, plon = ray_latlon(lat_deg, lon_deg, d)
        x, y = dem.xy(plat, plon)
        h = dem.height(np.asarray(x), np.asarray(y))
        for dem_j, lo_j, hi_j in spans:     # drop points an earlier tier covers
            xj, yj = dem_j.xy(plat, plon)
            covered = np.isfinite(dem_j.height(np.asarray(xj), np.asarray(yj)))
            covered &= (d[None, :] > lo_j) & (d[None, :] <= hi_j)
            h = np.where(covered, np.nan, h)
        spans.append((dem, min_m, max_m))
        has = np.isfinite(h)
        for m in masts_m:
            el = np.where(has, elevation_angle(d[None, :], h, ground_m + m), -np.inf)
            tmax = el.max(axis=1)
            better = tmax > best[m]
            best[m] = np.where(better, tmax, best[m])
            src[m] = np.where(better, k, src[m])
    out = {m: np.where(np.isfinite(best[m]), best[m], NO_TERRAIN) for m in masts_m}
    return (out, src) if with_source else out


def site_horizon(dem: Dem, x, y, masts_m=(1.0, 5.0), far=None, with_source=False):
    """Horizon at map point (x, y) of a site DEM, near field from the site DEM
    in 5 m steps, then any far field tiers given as [(dem, step_m, max_m)].

    Returns (ground_m, horizons[, sources])."""
    lat, lon = dem.latlon(x, y)
    ground = float(dem.height(np.array([x]), np.array([y]))[0])
    ny, nx = dem.shape
    tiers = [(dem, dem.res, np.hypot(nx, ny) * dem.res)] + list(far or [])
    res = horizon(tiers, lat, lon, ground, masts_m, with_source)
    return (ground,) + (res if with_source else (res,))


def sphere_dip_deg(h0_m):
    """How far below horizontal a smooth sphere's edge lies from height h0."""
    return -np.degrees(np.arccos(R_M / (R_M + h0_m)))
