"""Validation. Run from the project root:

    .venv\\Scripts\\python -m pipeline.validate            all checks: table + plots
    .venv\\Scripts\\python -m pipeline.validate <check>    one check, printed

Outputs go to docs/validation/: summary.md (one table) and one plot per check.
Checks: ephemeris, synthetic, barker, farfield, thermal (in the report), plus
disc, slope and nearfield (printed only).
"""
import sys
import time
from pathlib import Path

import numpy as np
import spiceypy as spice

from pipeline import ephemeris as eph
from pipeline import horizon as hz
from pipeline import thermal as th
from pipeline import visibility as vis
from pipeline.terrain import Dem, DEM_DIR, site_dem

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "validation"

SITE01_HIGH = {"lat": -89.4389, "lon": -137.1436, "ground_m": 1959.5}   # step 1 point
SITE01_ROI1 = (-11582.5, -12462.5)                                      # map metres
BARKER_PERIOD = ("2024-01-01T00:00:00Z", 2 * 365 * 24 + 24)            # 2024 is a leap year
# Barker et al. (2021) Table 2, Site 1 RoI 1: (avg illumination %, LCSP d, LCIP d)
BARKER = {1.0: {"A": (68.03, 16.55, 63.35), "C": (85.84, 10.46, 205.38)},
          5.0: {"A": (89.26, 5.29, 215.79), "C": (91.83, 3.70, 232.50)}}

# Chart colours (light theme, categorical slots in fixed order)
C1, C2, C3 = "#2a78d6", "#eb6834", "#1baf7a"
INK, INK2, GRID, BG = "#0b0b0b", "#52514e", "#e4e3df", "#fcfcfb"


def wrap180(d):
    return (np.asarray(d) + 180.0) % 360.0 - 180.0


def _fig(nrows=1, ncols=1, w=10, h=4):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    fig, axes = plt.subplots(nrows, ncols, figsize=(w, h), dpi=150, squeeze=False)
    fig.patch.set_facecolor(BG)
    for ax in axes.ravel():
        ax.set_facecolor(BG)
        ax.grid(color=GRID, lw=0.6)
        ax.tick_params(colors=INK2, labelsize=8)
        for side in ("top", "right"):
            ax.spines[side].set_visible(False)
        for side in ("left", "bottom"):
            ax.spines[side].set_color(INK2)
    return fig, axes


def _save(fig, name):
    OUT.mkdir(parents=True, exist_ok=True)
    fig.tight_layout()
    fig.savefig(OUT / name)
    return f"docs/validation/{name}"


# ---------------------------------------------------------------- ephemeris
def run_ephemeris(start="2027-01-01T00:00:00Z", days=60):
    """Our Sun/Earth az/el vs SPICE azlcpo and JPL Horizons, Site01 high point."""
    s = SITE01_HIGH
    h_m = s["ground_m"] + 1.0
    n = days * 24
    ets = eph.hourly_ets(start, n)
    sky = eph.site_sky(s["lat"], s["lon"], h_m, ets)
    site_km = spice.latrec(eph.MOON_R_KM + h_m / 1000.0, np.radians(s["lon"]), np.radians(s["lat"]))
    res = {"n": n, "start": start, "sky": sky}
    for key, tgt in (("sun", "SUN"), ("earth", "EARTH")):
        az, el = np.empty(n), np.empty(n)
        for i, et in enumerate(ets):
            st, _ = spice.azlcpo("ELLIPSOID", tgt, et, "LT+S", False, True, site_km, "MOON", "MOON_ME")
            az[i], el[i] = np.degrees(st[1]), np.degrees(st[2])
        res[("azlcpo", key)] = (wrap180(sky[key + "_az"] - az), sky[key + "_el"] - el)
    try:
        from astroquery.jplhorizons import Horizons
        stop = np.datetime64(start.replace("Z", "")) + np.timedelta64(days, "D")
        loc = {"lon": s["lon"], "lat": s["lat"], "elevation": h_m / 1000.0, "body": 301}
        for key, tgt in (("sun", "10"), ("earth", "399")):
            tab = Horizons(id=tgt, location=loc,
                           epochs={"start": start[:16].replace("T", " "),
                                   "stop": str(stop)[:16].replace("T", " "), "step": "1h"}
                           ).ephemerides(quantities="4")
            az = np.asarray(tab["AZ"], float)[:n]
            el = np.asarray(tab["EL"], float)[:n]
            res[("horizons", key)] = (wrap180(sky[key + "_az"] - az), sky[key + "_el"] - el)
    except Exception as e:  # network down: report, do not crash
        res["horizons_error"] = str(e)
    return res


def print_ephemeris(r):
    print(f"Site01 high point, {r['n']} hourly samples from {r['start']}")
    print(f"{'body':6} {'reference':10} {'max |d az| deg':>15} {'max |d el| deg':>15}")
    for key in ("sun", "earth"):
        for ref in ("azlcpo", "horizons"):
            if (ref, key) in r:
                daz, dele = r[(ref, key)]
                print(f"{key:6} {ref:10} {np.abs(daz).max():15.6f} {np.abs(dele).max():15.6f}")
    if "horizons_error" in r:
        print("Horizons query failed:", r["horizons_error"])


def plot_ephemeris(r):
    if ("horizons", "sun") not in r:
        return None
    fig, axes = _fig(1, 2, 10, 3.6)
    days = np.arange(r["n"]) / 24
    for ax, key, title in ((axes[0, 0], "sun", "Sun"), (axes[0, 1], "earth", "Earth")):
        daz, dele = r[("horizons", key)]
        ax.plot(days, dele * 3600, color=C1, lw=1.5, label="elevation")
        ax.plot(days, daz * 3600, color=C2, lw=1.5, label="azimuth")
        ax.axhline(0, color=INK2, lw=0.8)
        ax.set_title(f"{title}: ours minus JPL Horizons", loc="left", fontsize=10, color=INK)
        ax.set_xlabel("Days from 1 Jan 2027", fontsize=9, color=INK2)
        ax.set_ylabel("Difference, arcseconds", fontsize=9, color=INK2)
        ax.legend(frameon=False, fontsize=8, loc="upper right", ncol=2)
    rad = 0.27 * 3600
    fig.suptitle(f"Ephemeris check, Site01 high point (for scale, the Sun's radius is {rad:.0f} arcseconds)",
                 x=0.01, ha="left", fontsize=10, color=INK2)
    return _save(fig, "ephemeris_vs_horizons.png")


# ---------------------------------------------------------------- synthetic horizon
def run_synthetic():
    """Flat ground with two blocks of known size, compared with the hand formula."""
    from pyproj import CRS
    crs = CRS.from_proj4("+proj=stere +lat_0=-90 +lon_0=0 +R=1737400 +units=m")
    res, half = 5.0, 1000
    probe = Dem(np.zeros((1, 1)), 0, 0, 1, crs.to_wkt())
    xc, yc = probe.xy(-89.0, 0.0)
    xs = xc + (np.arange(2 * half + 1) - half) * res
    ys = yc - (np.arange(2 * half + 1) - half) * res
    X, Y = np.meshgrid(xs - xc, ys - yc)
    z = np.zeros_like(X)
    z[(Y >= 2000) & (Y <= 2200) & (np.abs(X) <= 500)] = 100.0   # 100 m block, 2 km north
    z[(X >= 3000) & (X <= 3100) & (np.abs(Y) <= 300)] = 50.0    # 50 m block, 3 km east
    dem = Dem(z, xs[0] - res / 2, ys[0] + res / 2, res, crs.to_wkt())
    mast, R = 1.0, 1737400.0
    _, out = hz.site_horizon(dem, xc, yc, masts_m=(mast,))

    def hand(height, d):
        return np.degrees(np.arctan((height - mast - d ** 2 / (2 * R)) / d))

    rows = [("north block", 0.0, hand(100, 2000)), ("east block", 90.0, hand(50, 3000)),
            ("flat ground", 45.0, hz.sphere_dip_deg(mast)), ("flat ground", 225.0, hz.sphere_dip_deg(mast))]
    rows = [(nm, az, exp, out[mast][int(round(az / hz.AZ_STEP))]) for nm, az, exp in rows]
    return {"horizon": out[mast], "rows": rows}


def print_synthetic(r):
    print("Synthetic map: flat ground, 1 m mast, observer at 89 S 0 E")
    print(f"{'direction':22} {'expected deg':>13} {'computed deg':>13} {'diff deg':>10}")
    for nm, az, exp, got in r["rows"]:
        print(f"{nm + f' (az {az:.0f})':22} {exp:13.5f} {got:13.5f} {got - exp:10.5f}")


def plot_synthetic(r):
    fig, axes = _fig(1, 1, 10, 3.6)
    ax = axes[0, 0]
    ax.plot(hz.AZ, r["horizon"], color=C1, lw=2, label="computed horizon")
    for i, (nm, az, exp, got) in enumerate(r["rows"]):
        ax.plot(az, exp, "o", ms=9, mfc="none", mec=C2, mew=2, label="hand calculation" if i == 0 else None)
        ax.annotate(f"{nm}\n{exp:.3f} deg", (az, exp), xytext=(10, -26 if exp > 2 else 8),
                    textcoords="offset points", fontsize=8, color=INK2)
    ax.set_xlim(0, 360)
    ax.set_xticks(range(0, 361, 45))
    ax.set_xlabel("Azimuth, degrees clockwise from north", fontsize=9, color=INK2)
    ax.set_ylabel("Horizon elevation, degrees", fontsize=9, color=INK2)
    ax.set_title("Synthetic map check: 100 m block 2 km north, 50 m block 3 km east, 1 m mast",
                 loc="left", fontsize=10, color=INK)
    ax.set_ylim(-0.3, 3.3)
    ax.legend(frameon=False, fontsize=8, loc="upper center")
    return _save(fig, "horizon_synthetic.png")


# ---------------------------------------------------------------- Barker bracket
def _sun_metrics(f):
    return 100 * f.mean(), vis.longest_run(f <= 0) / 24, vis.longest_run(f > 0) / 24


def run_barker():
    """Site01 RoI 1 over Barker's period with Barker's definitions:
    average illumination = mean visible fraction, LCSP = longest run with no
    Sun at all, LCIP = longest run with any Sun. Barker Table 2 values are
    clone percentiles: row A averages the RoI (cautious), row C takes the
    best pixel each hour (optimistic). A single point should fall between."""
    from pipeline.build import far_tiers
    dem = site_dem("Site01")
    x, y = SITE01_ROI1
    lat, lon = dem.latlon(x, y)
    ets = eph.hourly_ets(*BARKER_PERIOD)
    res = {}
    for name, far in (("tile only", []), ("3 tiers", far_tiers())):
        ground, hor = hz.site_horizon(dem, x, y, (1.0, 5.0), far)
        sky = eph.site_sky(lat, lon, ground + 1.0, ets)
        for m in (1.0, 5.0):
            res[(name, m)] = _sun_metrics(
                vis.disc_fraction(hor[m], sky["sun_az"], sky["sun_el"], sky["sun_rad"]))
    return res


def barker_within(r, m, k):
    a, c = BARKER[m]["A"][k], BARKER[m]["C"][k]
    return min(a, c) <= r[("3 tiers", m)][k] <= max(a, c)


def print_barker(r):
    print("Site01 RoI 1, 2024-01-01 to 2026-01-01, Barker's definitions")
    print(f"{'mast':5} {'source':34} {'avg illum %':>11} {'LCSP d':>8} {'LCIP d':>8}")
    for m in (1.0, 5.0):
        for name in ("tile only", "3 tiers"):
            v = r[(name, m)]
            print(f"{m:3.0f} m {'ours, ' + name:34} {v[0]:11.1f} {v[1]:8.2f} {v[2]:8.1f}")
        for case, label in (("A", "Barker A (RoI average, cautious)"), ("C", "Barker C (best pixel, optimistic)")):
            b = BARKER[m][case]
            print(f"{'':5} {label:34} {b[0]:11.1f} {b[1]:8.2f} {b[2]:8.1f}")


def plot_barker(r):
    fig, axes = _fig(1, 3, 10, 3.2)
    labels = ("Average illumination, %", "Longest shadow (LCSP), days", "Longest lit (LCIP), days")
    for k, ax in enumerate(axes[0]):
        for row, m in enumerate((1.0, 5.0)):
            a, c = BARKER[m]["A"][k], BARKER[m]["C"][k]
            ax.plot([a, c], [row, row], color=INK2, lw=5, alpha=0.25, solid_capstyle="round",
                    label="Barker range, A to C" if (k, row) == (0, 0) else None)
            ax.plot(r[("tile only", m)][k], row, "o", ms=8, mfc=BG, mec=INK2, mew=1.5,
                    label="ours, site map only" if (k, row) == (0, 0) else None)
            ax.plot(r[("3 tiers", m)][k], row, "o", ms=8, color=C1,
                    label="ours, with far field" if (k, row) == (0, 0) else None)
        ax.set_yticks([0, 1])
        ax.set_yticklabels(["1 m mast", "5 m mast"])
        ax.set_ylim(-0.6, 1.6)
        ax.set_title(labels[k], loc="left", fontsize=9, color=INK)
    fig.legend(*axes[0, 0].get_legend_handles_labels(), frameon=False, fontsize=8,
               loc="lower center", ncol=3, bbox_to_anchor=(0.5, -0.02))
    fig.suptitle("Site01 RoI 1, 2024 to 2025: our single point against Barker et al. (2021) Table 2",
                 x=0.01, ha="left", fontsize=10, color=INK)
    fig.tight_layout(rect=(0, 0.08, 1, 1))
    OUT.mkdir(parents=True, exist_ok=True)
    fig.savefig(OUT / "barker_bracket_site01.png")
    return "docs/validation/barker_bracket_site01.png"


# ---------------------------------------------------------------- far field
def run_farfield(start="2027-01-01T00:00:00Z", n=8760):
    from pipeline.build import far_tiers
    dem = site_dem("Site01")
    x, y = SITE01_ROI1
    lat, lon = dem.latlon(x, y)
    full = far_tiers()
    cases = {"site map only": ([], ["tile"]),
             "+ mosaic": (full[:1], ["tile", "mosaic"]),
             "+ mosaic + 240 m map": (full, ["tile", "mosaic", "polar"])}
    ets = eph.hourly_ets(start, n)
    res = {"cases": cases, "hor": {}, "src": {}, "stats": {}}
    sky = None
    for name, (far, _) in cases.items():
        ground, h, s = hz.site_horizon(dem, x, y, (1.0, 5.0), far, with_source=True)
        if sky is None:
            sky = eph.site_sky(lat, lon, ground + 1.0, ets)
        res["hor"][name], res["src"][name] = h, s
        for m in (1.0, 5.0):
            res["stats"][(name, m)] = vis.summary(
                vis.disc_fraction(h[m], sky["sun_az"], sky["sun_el"], sky["sun_rad"]),
                vis.disc_fraction(h[m], sky["earth_az"], sky["earth_el"], sky["earth_rad"]))
    res["earth_az"] = (sky["earth_az"].min(), sky["earth_az"].max())
    return res


def print_farfield(r):
    print("Site01 RoI 1, 2027")
    print(f"{'case':22} {'mast':>4} {'sunlit %':>9} {'dark d':>7} {'Earth %':>8} {'both %':>7}  azimuths set by")
    for name, (_, labels) in r["cases"].items():
        for m in (1.0, 5.0):
            st = r["stats"][(name, m)]
            counts = ", ".join(f"{lab} {np.sum(r['src'][name][m] == k)}" for k, lab in enumerate(labels))
            print(f"{name:22} {m:3.0f}m {st['sunlit_pct']:9.1f} {st['longest_dark_h'] / 24:7.1f} "
                  f"{st['earth_pct']:8.1f} {st['both_pct']:7.1f}  {counts}")


def plot_farfield(r):
    fig, axes = _fig(1, 1, 10, 4)
    ax = axes[0, 0]
    e0, e1 = r["earth_az"]
    ax.axvspan(e0, e1, color="#c3c2b7", alpha=0.35, lw=0)
    ax.text((e0 + e1) / 2, 0.02, "Earth\ndirections", transform=ax.get_xaxis_transform(),
            ha="center", va="bottom", fontsize=8, color=INK2)
    for (name, col) in zip(r["cases"], (INK2, C2, C1)):
        st = r["stats"][(name, 1.0)]
        ax.plot(hz.AZ, r["hor"][name][1.0], color=col, lw=1.8 if col != INK2 else 1.2,
                label=f"{name}: sunlit {st['sunlit_pct']:.1f}%, Earth visible {st['earth_pct']:.1f}%")
    ax.set_xlim(0, 360)
    ax.set_xticks(range(0, 361, 45))
    ax.set_xlabel("Azimuth, degrees clockwise from north", fontsize=9, color=INK2)
    ax.set_ylabel("Horizon elevation, degrees", fontsize=9, color=INK2)
    ax.set_title("Site01 RoI 1, 1 m mast: what distant terrain adds to the horizon (numbers for 2027)",
                 loc="left", fontsize=10, color=INK)
    ax.legend(frameon=False, fontsize=8, loc="upper left")
    return _save(fig, "farfield_site01.png")


# ---------------------------------------------------------------- thermal
def run_thermal(start="2027-01-01T00:00:00Z", days=90):
    """Flat ground on the equator (0 N, 0 E) with a flat horizon, real Sun
    positions, through three lunar days. Compare noon and pre-dawn with
    Diviner equatorial values (Vasavada et al. 2012)."""
    ets = eph.hourly_ets(start, days * 24)
    sky = eph.site_sky(0.0, 0.0, 1.0, ets)
    f = vis.disc_fraction_flat(sky["sun_el"], sky["sun_rad"])
    T = th.ground_temperature(f, sky["sun_az"], sky["sun_el"], 0.0, 0.0)
    rises = np.where((f[1:] > 0) & (f[:-1] <= 0))[0]          # last dark hour before each sunrise
    return {"T": T, "f": f, "noon_max": float(T.max()),
            "predawn": [float(T[i]) for i in rises],
            "noon_eq": float(th.t_equilibrium(1.0, 1.0))}


def print_thermal(r):
    print(f"Equator, flat ground: noon max {r['noon_max']:.1f} K (Diviner about 387 to 390 K); "
          f"pre-dawn {', '.join(f'{t:.1f}' for t in r['predawn'])} K (Diviner about 95 K)")
    print(f"Night floor {th.T_FLOOR:.1f} K, slab heat capacity {th.HEAT_CAP:.3g} J/m^2/K")


def plot_thermal(r):
    fig, axes = _fig(1, 1, 10, 3.8)
    ax = axes[0, 0]
    days = np.arange(len(r["T"])) / 24
    ax.axhspan(387, 390, color=C2, alpha=0.25, lw=0)
    ax.text(days[-1], 392, "Diviner noon, 387 to 390 K", ha="right", fontsize=8, color=INK2)
    ax.axhline(95, color=C2, lw=1, ls="--")
    ax.text(days[0], 78, "Diviner pre-dawn, about 95 K", ha="left", fontsize=8, color=INK2)
    ax.plot(days, r["T"], color=C1, lw=1.8, label="model")
    ax.set_xlabel("Days from 1 Jan 2027", fontsize=9, color=INK2)
    ax.set_ylabel("Ground temperature, K", fontsize=9, color=INK2)
    ax.set_ylim(0, 420)
    ax.set_title("Thermal model on flat ground at the equator, against Diviner equatorial temperatures",
                 loc="left", fontsize=10, color=INK)
    return _save(fig, "thermal_equator.png")


# ---------------------------------------------------------------- printed-only checks
def check_disc():
    flat = np.zeros(720)
    for name, rho in (("Sun", 0.27), ("Earth", 0.95)):
        el = np.linspace(-1.5 * rho, 1.5 * rho, 301)
        d = vis.disc_fraction(flat, np.full_like(el, 100.0), el, rho) - vis.disc_fraction_flat(el, rho)
        print(f"{name}: strip method vs closed form, max |difference| {np.abs(d).max():.5f}")
    tilt = (np.arange(720) * 0.5 - 100.0)
    f = vis.disc_fraction(tilt, np.array([100.0]), np.array([0.0]), 0.95)[0]
    print(f"Earth disc, horizon tilted 45 deg through its centre: {f:.4f} (expect 0.5)")


def check_slope():
    import rasterio
    dem = site_dem("Site01")
    with rasterio.open(DEM_DIR / "Site01_final_adj_5mpp_slp.tif") as src:
        slp = src.read(1)
    rng = np.random.default_rng(1)
    ny, nx = dem.shape
    ours, theirs = [], []
    for _ in range(200):
        r, c = rng.integers(10, ny - 10), rng.integers(10, nx - 10)
        x, y = dem.x_ul + (c + 0.5) * dem.res, dem.y_ul - (r + 0.5) * dem.res
        ours.append(dem.slope(x, y)[0])
        theirs.append(float(slp[r, c]))
    ours, theirs = np.array(ours), np.array(theirs)
    ok = np.isfinite(theirs)
    d = ours[ok] - theirs[ok]
    print(f"Slope vs PGDA slope map, 200 points: median |difference| {np.median(np.abs(d)):.2f} deg, "
          f"correlation {np.corrcoef(ours[ok], theirs[ok])[0, 1]:.3f}")


def check_nearfield():
    s = SITE01_HIGH
    dem = site_dem("Site01")
    x, y = dem.xy(s["lat"], s["lon"])
    ground, out = hz.site_horizon(dem, x, y, masts_m=(1.0, 5.0))
    for mast, h in out.items():
        print(f"Site01 high point, tile only, {mast:.0f} m mast: min {h.min():.2f}, max {h.max():.2f}, "
              f"mean {h.mean():.2f} deg")


# ---------------------------------------------------------------- report
def report():
    t0 = time.perf_counter()
    rows, plots = [], []

    e = run_ephemeris()
    for ref, label in (("horizons", "JPL Horizons"), ("azlcpo", "SPICE azlcpo")):
        if (ref, "sun") in e:
            worst = max(np.abs(v).max() for key in ("sun", "earth") for v in e[(ref, key)])
            rows.append((f"Sun and Earth az/el vs {label} (60 days, hourly)", "< 0.01 deg",
                         f"max {worst:.5f} deg", worst < 0.01))
        else:
            rows.append((f"Sun and Earth az/el vs {label}", "< 0.01 deg", "not run (no network)", None))
    plots.append(plot_ephemeris(e))

    s = run_synthetic()
    worst = max(abs(got - exp) for *_, exp, got in s["rows"])
    rows.append(("Horizon on synthetic map vs hand formula (4 directions)", "< 0.001 deg",
                 f"max {worst:.5f} deg", worst < 0.001))
    plots.append(plot_synthetic(s))

    b = run_barker()
    for m in (1.0, 5.0):
        v = b[("3 tiers", m)]
        ok = all(barker_within(b, m, k) for k in range(3))
        rows.append((f"Site01 RoI 1 vs Barker et al. 2021, {m:.0f} m mast", "between rows A and C",
                     f"{v[0]:.1f}%, LCSP {v[1]:.1f} d, LCIP {v[2]:.1f} d", ok))
    plots.append(plot_barker(b))

    f = run_farfield()
    a, c = f["stats"][("site map only", 1.0)], f["stats"][("+ mosaic + 240 m map", 1.0)]
    a5, c5 = f["stats"][("site map only", 5.0)], f["stats"][("+ mosaic + 240 m map", 5.0)]
    rows.append(("Far field effect, Site01 RoI 1, 2027 (1 m / 5 m)", "reported",
                 f"sunlit {c['sunlit_pct'] - a['sunlit_pct']:+.1f} / {c5['sunlit_pct'] - a5['sunlit_pct']:+.1f} pts, "
                 f"Earth {c['earth_pct'] - a['earth_pct']:+.1f} / {c5['earth_pct'] - a5['earth_pct']:+.1f} pts", None))
    plots.append(plot_farfield(f))

    t = run_thermal()
    rows.append(("Thermal model, equator noon", "387 to 390 K (Diviner)",
                 f"{t['noon_max']:.0f} K", abs(t["noon_max"] - 388.5) < 6))
    pd = np.mean(t["predawn"])
    rows.append(("Thermal model, equator pre-dawn", "about 95 K (Diviner)",
                 f"{pd:.0f} K (mean of {len(t['predawn'])} nights)", abs(pd - 95) < 6))
    plots.append(plot_thermal(t))

    mark = {True: "pass", False: "FAIL", None: "info"}
    lines = ["# Validation summary", "",
             f"Generated by `python -m pipeline.validate` on {time.strftime('%d %b %Y %H:%M')}.", "",
             "| Check | Expected | Result | Status |", "|---|---|---|---|"]
    lines += [f"| {c} | {e_} | {r_} | {mark[ok]} |" for c, e_, r_, ok in rows]
    lines += ["", "Plots: " + ", ".join(f"`{p.split('/')[-1]}`" for p in plots if p), ""]
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "summary.md").write_text("\n".join(lines), encoding="utf-8")

    w = max(len(r[0]) for r in rows)
    for c, e_, r_, ok in rows:
        print(f"{mark[ok]:5} {c:{w}}  {r_}   (expected {e_})")
    print(f"\nwrote docs/validation/summary.md and {sum(1 for p in plots if p)} plots, "
          f"{time.perf_counter() - t0:.0f} s")


CHECKS = {
    "ephemeris": lambda: print_ephemeris(run_ephemeris()),
    "synthetic": lambda: print_synthetic(run_synthetic()),
    "barker": lambda: print_barker(run_barker()),
    "farfield": lambda: print_farfield(run_farfield()),
    "thermal": lambda: print_thermal(run_thermal()),
    "disc": check_disc,
    "slope": check_slope,
    "nearfield": check_nearfield,
}

if __name__ == "__main__":
    what = sys.argv[1] if len(sys.argv) > 1 else "report"
    if what == "report":
        report()
    elif what in CHECKS:
        CHECKS[what]()
    else:
        sys.exit(f"unknown check: {what}; choose report or one of {', '.join(CHECKS)}")
