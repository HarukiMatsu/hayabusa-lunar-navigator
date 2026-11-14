# Use of Artificial Intelligence

Running log of how Claude Code (Anthropic) was used on this project.

| Date | What Claude Code was asked to do | What it produced |
|---|---|---|
| 12 Nov 2026 (before the event, practice only) | Read the project brief and set up the machine | Saved the brief as `CLAUDE.md`, created folders, downloaded the SPICE kernels and the four PGDA site elevation maps, created the Python environment |
| 13 Nov 2026 (before the event, practice only) | Download the mosaic and the Barker paper; write and run practice scripts | Six throwaway study scripts in `study/` (download check, horizon, SPICE comparison, illumination, speed test, far field test), with explanations of each output. Findings recorded in section 12 of `CLAUDE.md`. No submission code |
| 14 Nov 2026 | Summarise the project directory | `DIRECTORY_SUMMARY.md` |
| 14 Nov 2026 (from 14:27, event build) | Start the real pipeline: check the Python environment, delete `study/`, set up git, rewrite the data contract (section 5 of `CLAUDE.md`) for a single `web/data/visibility.json`, then build `pipeline/` one stage at a time with a check after each | Step 1: `pipeline/ephemeris.py` (Sun and Earth azimuth, elevation and angular radius from SPICE) and the Horizons check in `pipeline/validate.py`. Our positions agree with SPICE `azlcpo` and JPL Horizons to within 0.00004 degrees at the Site01 high point over 60 days of 2027. All code written fresh in this session |
