"""Fraction of the Sun's or Earth's disc that is above the terrain horizon.

The disc (angular radius rho, centre at azimuth az and elevation el) is cut
into thin vertical strips. A strip at angular offset u from the centre has
half-height c = sqrt(rho^2 - u^2) and sits at azimuth az + u / cos(el). With
the horizon height H in that strip, the visible part of the strip is
clamp(el + c - H, 0, 2c). Summing over strips and dividing by the disc area
pi rho^2 gives the visible fraction.

On a flat horizon this equals the closed form in CLAUDE.md section 2,

    f = 1/2 + (x sqrt(1 - x^2) + asin x) / pi,   x = clamp((el - H) / rho, -1, 1),

but it also handles a horizon that slopes across the disc, which matters for
Earth (about 2 degrees wide).
"""
import numpy as np

N_STRIPS = 64


def horizon_at(horizon, az_deg):
    """Linear interpolation of a 720 value horizon (0.5 deg steps) at any azimuth."""
    n = len(horizon)
    step = 360.0 / n
    p = (np.asarray(az_deg) % 360.0) / step
    i0 = np.floor(p).astype(np.int64) % n
    f = p - np.floor(p)
    h = np.asarray(horizon)
    return (1 - f) * h[i0] + f * h[(i0 + 1) % n]


def disc_fraction(horizon, az_deg, el_deg, rho_deg, n_strips=N_STRIPS):
    """Visible fraction (0..1) of a disc for each time step."""
    az = np.asarray(az_deg, float)[:, None]
    el = np.asarray(el_deg, float)[:, None]
    rho = np.asarray(rho_deg, float)
    rho = (rho[:, None] if rho.ndim else np.full_like(el, rho))
    # strip centres in units of rho, midpoint rule
    s = (np.arange(n_strips) + 0.5) / n_strips * 2.0 - 1.0
    u = s[None, :] * rho
    c = np.sqrt(np.maximum(rho ** 2 - u ** 2, 0.0))
    H = horizon_at(horizon, az + u / np.cos(np.radians(el)))
    visible = np.clip(el + c - H, 0.0, 2.0 * c)
    width = 2.0 * rho / n_strips
    return (visible * width).sum(axis=1) / (np.pi * rho[:, 0] ** 2)


def disc_fraction_flat(delta_deg, rho_deg):
    """Closed form for a flat horizon; used to check disc_fraction."""
    x = np.clip(np.asarray(delta_deg) / rho_deg, -1.0, 1.0)
    return 0.5 + (x * np.sqrt(1 - x ** 2) + np.arcsin(x)) / np.pi


def longest_run(mask):
    """Length of the longest run of True values."""
    best = cur = 0
    for v in np.asarray(mask, bool):
        cur = cur + 1 if v else 0
        best = max(best, cur)
    return best


def summary(sun_frac, earth_frac, step_hours=1.0):
    """Headline numbers for one site and mast (section 3 of CLAUDE.md)."""
    lit = sun_frac >= 0.5
    earth = earth_frac >= 0.5
    return {
        "sunlit_pct": 100 * float(np.mean(sun_frac)),
        "longest_dark_h": longest_run(~lit) * step_hours,
        "longest_no_sun_h": longest_run(sun_frac <= 0) * step_hours,
        "longest_lit_h": longest_run(sun_frac > 0) * step_hours,
        "earth_pct": 100 * float(np.mean(earth)),
        "longest_blackout_h": longest_run(~earth) * step_hours,
        "both_pct": 100 * float(np.mean(lit & earth)),
    }
