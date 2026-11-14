# References

## Data

- Barker, M. K., Mazarico, E., Neumann, G. A., Smith, D. E., Zuber, M. T., Head, J. W., Sun, X. (2021). Improved LOLA elevation maps for south pole landing sites: Error estimates and their impact on illumination conditions. *Planetary and Space Science* 203, 105119. doi:10.1016/j.pss.2020.105119. Data: NASA GSFC Planetary Geodesy Data Archive, product 78, https://pgda.gsfc.nasa.gov/products/78
- LOLA south pole 5 m/pixel mosaic, 87 to 90 degrees S. NASA GSFC Planetary Geodesy Data Archive, product 81, https://pgda.gsfc.nasa.gov/products/81
- LOLA polar gridded topography `LDEM_75S_240M` (75 to 90 degrees S, 240 m/pixel). Neumann, G. A. (2009), Lunar Reconnaissance Orbiter Lunar Orbiter Laser Altimeter Reduced Data Record and Derived Products Software Interface Specification, LRO-L-LOLA-4-GDR-V1.0, NASA Planetary Data System. https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/
- Smith, D. E. et al. (2010). Initial observations from the Lunar Orbiter Laser Altimeter (LOLA). *Geophysical Research Letters* 37, L18204. doi:10.1029/2010GL043751
- NAIF generic SPICE kernels: `naif0012.tls`, `pck00010.tpc`, `de421.bsp`, `moon_pa_de421_1900-2050.bpc`, `moon_080317.tf`. https://naif.jpl.nasa.gov/pub/naif/generic_kernels/
- Folkner, W. M., Williams, J. G., Boggs, D. H. (2009). The Planetary and Lunar Ephemeris DE 421. JPL IOM 343R-08-003.
- JPL Horizons on-line ephemeris system, https://ssd.jpl.nasa.gov/horizons/ (used for validation only)

## Method

- Mazarico, E., Neumann, G. A., Smith, D. E., Zuber, M. T., Torrence, M. H. (2011). Illumination conditions of the lunar polar regions using LOLA topography. *Icarus* 211, 1066 to 1081. doi:10.1016/j.icarus.2010.10.030

## Thermal model constants

- Albedo 0.12 and emissivity 0.95: Vasavada, A. R. et al. (2012). Lunar equatorial surface temperatures and regolith properties from the Diviner Lunar Radiometer Experiment. *Journal of Geophysical Research* 117, E00H18. doi:10.1029/2011JE003987. Same values in Hayne, P. O. et al. (2017). Global regolith thermophysical properties of the Moon from the Diviner Lunar Radiometer Experiment. *Journal of Geophysical Research: Planets* 122, 2371 to 2400. doi:10.1002/2017JE005387
- Equatorial noon (about 387 to 390 K) and pre-dawn (about 95 K) surface temperatures, used to check the model and to set the cooling rate: Vasavada et al. (2012), above.
- Night floor from lunar heat flow (21 and 16 mW/m2 at the Apollo 15 and 17 sites): Langseth, M. G., Keihm, S. J., Peters, K. (1976). Revised lunar heat-flow values. *Proceedings of the 7th Lunar Science Conference*, 3143 to 3171.
- Coldest observed polar shadow temperatures (about 25 K): Paige, D. A. et al. (2010). Diviner Lunar Radiometer observations of cold traps in the Moon's south polar region. *Science* 330, 479 to 483. doi:10.1126/science.1187726
- Solar constant 1361 W/m2: Kopp, G., Lean, J. L. (2011). A new, lower value of total solar irradiance: Evidence and climate significance. *Geophysical Research Letters* 38, L01706. doi:10.1029/2010GL045777
- Stefan-Boltzmann constant: CODATA 2018 recommended values (Tiesinga, E. et al. (2021), *Reviews of Modern Physics* 93, 025010).

## Software

- Acton, C. H. (1996). Ancillary data services of NASA's Navigation and Ancillary Information Facility. *Planetary and Space Science* 44, 65 to 70. (SPICE)
- Annex, A. M. et al. (2020). SpiceyPy: a Pythonic wrapper for the SPICE toolkit. *Journal of Open Source Software* 5(46), 2050. doi:10.21105/joss.02050
- Ginsburg, A. et al. (2019). astroquery: an astronomical web-querying package in Python. *Astronomical Journal* 157, 98. doi:10.3847/1538-3881/aafc33
- Harris, C. R. et al. (2020). Array programming with NumPy. *Nature* 585, 357 to 362. doi:10.1038/s41586-020-2649-2
- rasterio, https://github.com/rasterio/rasterio ; pyproj, https://github.com/pyproj4/pyproj ; Matplotlib (Hunter, J. D. (2007), *Computing in Science and Engineering* 9, 90 to 95)
