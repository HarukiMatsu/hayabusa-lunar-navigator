"""Terrain horizon: the elevation angle of the highest terrain in each of 720
directions (0.5 degree steps, clockwise from local north).

For terrain at surface distance d with height h, seen from observer height
h0 (ground + mast), both measured above the sphere of radius R, the
elevation angle on a spherical Moon is

    gamma = d / R
    el    = atan2((R + h) cos(gamma) - (R + h0), (R + h) sin(gamma))

For d << R this is atan((h - h0 - d^2 / 2R) / d), the formula in CLAUDE.md
section 2; the exact form is used so it stays right out to 100+ km.
"""
import numpy as np

from pipeline.terrain import Dem

R_M = 1737400.0
N_AZ = 720
AZ_STEP = 0.5
AZ = np.arange(N_AZ) * AZ_STEP
NO_TERRAIN = -90.0  # value for a direction where no terrain sample exists


def local_axes(dem: Dem, x, y):
    return dem.local_axes(x, y)


def elevation_angle(d_m, h_m, h0_m):
    g = d_m / R_M
    return np.degrees(np.arctan2((R_M + h_m) * np.cos(g) - (R_M + h0_m),
                                 (R_M + h_m) * np.sin(g)))


def ray_heights(dem: Dem, x, y, d_m):
    """Terrain heights along all 720 rays, shape (720, len(d_m)); NaN off map.

    The 'surface distance' is taken as map distance. The polar stereographic
    scale error is 2/(1 + sin|lat|) - 1, under 0.01% poleward of 88.5 S.
    """
    north, east = local_axes(dem, x, y)
    a = np.radians(AZ)[:, None]
    dirx = np.cos(a) * north[0] + np.sin(a) * east[0]
    diry = np.cos(a) * north[1] + np.sin(a) * east[1]
    return dem.height(x + dirx * d_m[None, :], y + diry * d_m[None, :])


def horizon(dem: Dem, x, y, masts_m=(1.0, 5.0), step_m=None, max_m=None):
    """Horizon for each mast height at map point (x, y) using one DEM.

    Returns (ground_m, {mast: array of 720 angles in degrees}). Directions
    with no terrain samples get NO_TERRAIN.
    """
    step = step_m or dem.res
    if max_m is None:
        ny, nx = dem.shape
        max_m = np.hypot(nx, ny) * dem.res
    d = np.arange(step, max_m + step, step)
    ground = float(dem.height(np.array([x]), np.array([y]))[0])
    h = ray_heights(dem, x, y, d)
    out = {}
    for mast in masts_m:
        el = elevation_angle(d[None, :], h, ground + mast)
        el = np.where(np.isnan(el), -np.inf, el)
        hz = el.max(axis=1)
        out[mast] = np.where(np.isfinite(hz), hz, NO_TERRAIN)
    return ground, out


def sphere_dip_deg(h0_m):
    """How far below horizontal a smooth sphere's edge lies from height h0."""
    return -np.degrees(np.arccos(R_M / (R_M + h0_m)))
