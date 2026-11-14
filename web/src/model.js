// model.js — Hayabusa mission model.
// Plain JavaScript, no React and no dependencies. Import these functions into any component.
// Every function is pure: same inputs give the same outputs, nothing is stored or fetched.
//
// Data shape (one JSON file):
//   data = { meta: { start_utc, step_hours, n_steps }, sites: [site, ...] }
//   site = { id, name, lat, lon, slope_deg, sun: [...], earth: [...],
//            sun_az, sun_el, earth_az, earth_el, ground_temp_k, horizon,
//            sun_5m, earth_5m }
// In every function below, `meta` is data.meta and `site` is one entry of data.sites.
// `mast` is '' for the default mast or '5m' for the taller one.

export const SIGMA = 5.670374e-8;   // Stefan-Boltzmann constant, W m^-2 K^-4
export const SOLAR_CONSTANT = 1361; // sunlight power at the Moon's distance from the Sun, W m^-2
export const UP = 0.5;              // a body counts as "up" when at least half its disc is visible

export const DEFAULT_REQUIREMENTS = {
  minSunShare: 0.7,     // average visible fraction of the Sun over the mission (solar energy)
  maxDarkHours: 48,     // longest stretch without sunlight the lander can survive
  minEarthShare: 0.5,   // fraction of the mission that needs Earth in view
  maxSlopeDeg: 10,      // steepest ground the lander can land on
  minTempK: 233,        // coldest the equipment may get (-40 C)
  maxTempK: 333,        // hottest the equipment may get (+60 C)
};

export const DEFAULT_LANDER = {
  emissivity: 0.85,       // how well the surface radiates heat (0 to 1)
  absorptivity: 0.3,      // fraction of sunlight the surface absorbs (0 to 1)
  radiatingAreaM2: 6,     // outside area that loses heat to space
  heatCapacityJK: 200000, // joules needed to warm the equipment by 1 K (about 220 kg of aluminium)
  insulation: 0.05,       // fraction of bare heat loss that gets through the insulation blankets (1 = no insulation)
};

/** Heat-loss coefficient of the insulated body, W K^-4. */
const lossCoefficient = (lander) => lander.insulation * lander.emissivity * SIGMA * lander.radiatingAreaM2;

/** The visibility list for a body ('sun' or 'earth') at a mast height; falls back to the default mast. */
export function series(site, body, mast = '') {
  return (mast && site[`${body}_${mast}`]) || site[body];
}

// ---- time ----

/** Index into the hourly lists for a given date. */
export function indexAt(meta, date) {
  const ms = new Date(date).getTime() - new Date(meta.start_utc).getTime();
  return Math.round(ms / (meta.step_hours * 3600000));
}

/** First and one-past-last index of a mission, clipped to the data. */
export function missionRange(meta, landingDate, missionDays) {
  const from = Math.max(0, indexAt(meta, landingDate));
  const steps = Math.round((missionDays * 24) / meta.step_hours);
  return { from, to: Math.min(meta.n_steps, from + steps) };
}

// ---- sunlight and Earth contact ----

function longestRun(values, from, to, test) {
  let best = 0, run = 0;
  for (let i = from; i < to; i++) {
    run = test(values[i]) ? run + 1 : 0;
    if (run > best) best = run;
  }
  return best;
}

/**
 * Sunlight, Earth contact and the longest gaps for a mission.
 * sunShare is the AVERAGE visible fraction of the Sun's disc (the definition used by
 * Barker et al. 2021, and proportional to solar panel energy). Everything yes/no
 * (earthShare, bothShare, the longest gaps) counts a body as up at half its disc or more.
 */
export function summarise(site, range, stepHours = 1, mast = '') {
  const sun_vis = series(site, 'sun', mast), earth_vis = series(site, 'earth', mast);
  const n = range.to - range.from;
  let sunSum = 0, earth = 0, both = 0;
  for (let i = range.from; i < range.to; i++) {
    const s = sun_vis[i] >= UP, e = earth_vis[i] >= UP;
    sunSum += sun_vis[i];
    if (e) earth++;
    if (s && e) both++;
  }
  return {
    sunShare: n ? sunSum / n : 0,
    earthShare: n ? earth / n : 0,
    bothShare: n ? both / n : 0,
    longestDarkHours: longestRun(sun_vis, range.from, range.to, (v) => v < UP) * stepHours,
    longestCommsGapHours: longestRun(earth_vis, range.from, range.to, (v) => v < UP) * stepHours,
  };
}

/**
 * Hours until the body next sets (if it is up now) or rises (if it is down now).
 * values is site.sun or site.earth (or series(site, 'sun', '5m')). Returns null if nothing changes in the data.
 */
export function hoursUntilChange(values, i, stepHours = 1) {
  const upNow = values[i] >= UP;
  for (let j = i + 1; j < values.length; j++) {
    if ((values[j] >= UP) !== upNow) return { hours: (j - i) * stepHours, event: upNow ? 'set' : 'rise' };
  }
  return null;
}

// ---- temperature ----

/**
 * Temperature of a surface facing the Sun, in kelvin, at radiative balance:
 * absorbed sunlight = radiated heat.  T = [ a * S * f / (e * sigma) ]^(1/4)
 * sunVis is the visible fraction of the Sun's disc (0 to 1).
 */
export function sunFacingTempK(sunVis, lander = DEFAULT_LANDER) {
  const absorbed = lander.absorptivity * SOLAR_CONSTANT * Math.max(0, sunVis);
  return Math.pow(absorbed / (lander.emissivity * SIGMA), 0.25);
}

/**
 * Temperature after `hours` of darkness with no heater, starting from startK.
 * Solves C dT/dt = -L * T^4, which gives T(t) = (T0^-3 + 3 k t)^(-1/3), with k = L / C and
 * L = insulation * e * sigma * A (the heat-loss coefficient).
 */
export function coolingTempK(startK, hours, lander = DEFAULT_LANDER) {
  const k = lossCoefficient(lander) / lander.heatCapacityJK;
  return Math.pow(Math.pow(startK, -3) + 3 * k * hours * 3600, -1 / 3);
}

/** Hours of darkness before the equipment cools from startK down to minK with no heater. */
export function hoursToCoolTo(startK, minK, lander = DEFAULT_LANDER) {
  if (startK <= minK) return 0;
  const k = lossCoefficient(lander) / lander.heatCapacityJK;
  return (Math.pow(minK, -3) - Math.pow(startK, -3)) / (3 * k) / 3600;
}

/** Heater power in watts that holds the equipment at minK: it must replace the heat radiated away. */
export function heaterPowerW(minK, lander = DEFAULT_LANDER) {
  return lossCoefficient(lander) * Math.pow(minK, 4);
}

/**
 * Thermal picture of a mission: hottest Sun-facing temperature, and for the longest darkness,
 * how long the equipment lasts unheated and how much heater energy the battery must supply.
 */
export function thermalSummary(site, range, req = DEFAULT_REQUIREMENTS, lander = DEFAULT_LANDER, stepHours = 1, mast = '') {
  const sun_vis = series(site, 'sun', mast);
  let hottestK = 0;
  for (let i = range.from; i < range.to; i++) hottestK = Math.max(hottestK, sunFacingTempK(sun_vis[i], lander));
  const darkHours = longestRun(sun_vis, range.from, range.to, (v) => v < UP) * stepHours;
  const startK = Math.min(hottestK, req.maxTempK);
  const coastHours = hoursToCoolTo(startK, req.minTempK, lander);
  const heaterHours = Math.max(0, darkHours - coastHours);
  return {
    hottestK,
    tooHot: hottestK > req.maxTempK,
    longestDarkHours: darkHours,
    hoursBeforeTooCold: coastHours,
    heaterPowerW: heaterPowerW(req.minTempK, lander),
    heaterEnergyWh: heaterPowerW(req.minTempK, lander) * heaterHours,
  };
}

// ---- pass or fail ----

/**
 * Tests one site and mission against the requirements. Every check is reported separately.
 * Cold is not a pass/fail check: thermal.hoursBeforeTooCold and thermal.heaterEnergyWh are
 * reported instead, because they depend on the lander's heater and battery.
 */
export function checkMission(site, range, req = DEFAULT_REQUIREMENTS, lander = DEFAULT_LANDER, stepHours = 1, mast = '') {
  const s = summarise(site, range, stepHours, mast);
  const t = thermalSummary(site, range, req, lander, stepHours, mast);
  const checks = {
    sunlight: s.sunShare >= req.minSunShare,
    power: s.longestDarkHours <= req.maxDarkHours,
    comms: s.earthShare >= req.minEarthShare,
    slope: site.slope_deg <= req.maxSlopeDeg,
    notTooHot: !t.tooHot,
  };
  return { pass: Object.values(checks).every(Boolean), checks, summary: s, thermal: t };
}

/**
 * For every possible landing day in the data: does the mission starting then pass?
 * Returns one entry per day, and `availability`, the share of days that pass.
 */
export function landingCalendar(meta, site, missionDays, req = DEFAULT_REQUIREMENTS, lander = DEFAULT_LANDER, mast = '') {
  const stepsPerDay = Math.round(24 / meta.step_hours);
  const span = Math.round((missionDays * 24) / meta.step_hours);
  const days = [];
  for (let from = 0; from + span <= meta.n_steps; from += stepsPerDay) {
    const result = checkMission(site, { from, to: from + span }, req, lander, meta.step_hours, mast);
    const date = new Date(new Date(meta.start_utc).getTime() + from * meta.step_hours * 3600000);
    days.push({ date: date.toISOString().slice(0, 10), pass: result.pass, checks: result.checks });
  }
  const passing = days.filter((d) => d.pass).length;
  return { days, availability: days.length ? passing / days.length : 0 };
}

/** Sites ordered best first by availability for this mission. */
export function rankSites(meta, sites, missionDays, req = DEFAULT_REQUIREMENTS, lander = DEFAULT_LANDER, mast = '') {
  return sites
    .map((site) => ({ id: site.id, name: site.name, availability: landingCalendar(meta, site, missionDays, req, lander, mast).availability }))
    .sort((a, b) => b.availability - a.availability);
}
