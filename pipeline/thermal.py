"""Ground surface temperature from the Sun's direction, the local slope and
the visible fraction of the Sun's disc. A deliberately simple model; see
CLAUDE.md section 12 and docs/references.md for the numbers used.

1. Incidence angle. Sun direction in local east, north, up:
       s = (cos(el) sin(az), cos(el) cos(az), sin(el))
   Surface normal for slope theta facing azimuth phi (downhill direction):
       n = (sin(theta) sin(phi), sin(theta) cos(phi), cos(theta))
   cos(i) = s . n. If cos(i) <= 0 the Sun is behind the slope.

2. Sunlit equilibrium (absorbed sunlight = emitted heat, no storage):
       T_eq = [ (1 - A) S f cos(i) / (eps sigma) ] ^ (1/4)

3. Cooling. The top layer of regolith is treated as one slab with an
   effective heat capacity per area C that radiates to space:
       C dT/dt = -eps sigma (T^4 - T_floor^4)
   T_floor is the temperature at which the Moon's internal heat flow alone
   balances radiation, T_floor = (q / (eps sigma))^(1/4).
   C is set so that a surface cooling through one equatorial night
   (14.77 days) ends at the observed pre-dawn equatorial temperature of
   about 95 K. Because cooling from any start above about 200 K is almost
   independent of the start, this one number fixes C:
       C = 3 eps sigma t_night T_dawn^3

4. Each hour: T = max(T_eq, T cooled for one hour from the previous value).
   So sunlight can only hold the surface at or above its equilibrium, and
   in shadow (or with the Sun behind the slope) it cools along step 3.
   Heating is taken as instant, which is reasonable when the Sun rises
   slowly, as it does at the poles.

The year is run twice and the second pass is kept, so the start of the
year begins from a realistic cooled state rather than an arbitrary guess.
"""
import numpy as np

S_1AU = 1361.0            # W/m^2, total solar irradiance (Kopp and Lean 2011)
ALBEDO = 0.12             # bolometric Bond albedo (Vasavada et al. 2012; Hayne et al. 2017)
EMISSIVITY = 0.95         # infrared emissivity (Vasavada et al. 2012; Hayne et al. 2017)
SIGMA = 5.670374419e-8    # W/m^2/K^4, Stefan-Boltzmann constant (CODATA 2018)
HEAT_FLOW = 0.018         # W/m^2, lunar surface heat flow (Langseth et al. 1976: 21 and 16 mW/m^2, Apollo 15 and 17)
T_DAWN_EQ = 95.0          # K, equatorial pre-dawn surface temperature (Vasavada et al. 2012)
NIGHT_S = 14.77 * 86400   # s, half a synodic month

T_FLOOR = (HEAT_FLOW / (EMISSIVITY * SIGMA)) ** 0.25
HEAT_CAP = 3 * EMISSIVITY * SIGMA * NIGHT_S * T_DAWN_EQ ** 3   # J/m^2/K


def cos_incidence(sun_az, sun_el, slope_deg, facing_deg):
    az, el = np.radians(sun_az), np.radians(sun_el)
    th, ph = np.radians(slope_deg), np.radians(facing_deg)
    return (np.cos(el) * np.sin(az) * np.sin(th) * np.sin(ph)
            + np.cos(el) * np.cos(az) * np.sin(th) * np.cos(ph)
            + np.sin(el) * np.cos(th))


def t_equilibrium(frac, cos_i, s_flux=S_1AU):
    absorbed = (1 - ALBEDO) * s_flux * np.asarray(frac) * np.clip(cos_i, 0.0, None)
    return (absorbed / (EMISSIVITY * SIGMA)) ** 0.25


def cool(T, dt_s, substeps=6):
    """Slab cooling over dt_s seconds (RK4)."""
    k = EMISSIVITY * SIGMA / HEAT_CAP
    h = dt_s / substeps

    def rate(t):
        return -k * (t ** 4 - T_FLOOR ** 4)

    for _ in range(substeps):
        k1 = rate(T)
        k2 = rate(T + 0.5 * h * k1)
        k3 = rate(T + 0.5 * h * k2)
        k4 = rate(T + h * k3)
        T = T + h * (k1 + 2 * k2 + 2 * k3 + k4) / 6
    return max(T, T_FLOOR)


def ground_temperature(frac, sun_az, sun_el, slope_deg, facing_deg, step_hours=1.0, passes=2):
    """Hourly ground temperature (K) for one site."""
    t_eq = t_equilibrium(frac, cos_incidence(sun_az, sun_el, slope_deg, facing_deg))
    out = np.empty(len(t_eq))
    T = float(t_eq[0]) if t_eq[0] > 0 else T_FLOOR
    dt = step_hours * 3600.0
    for _ in range(passes):
        for i, te in enumerate(t_eq):
            T = max(float(te), cool(T, dt))
            out[i] = T
    return out
