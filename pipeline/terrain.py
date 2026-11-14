"""Elevation maps: loading, lat/lon <-> map coordinates, height lookup.

All maps are south polar stereographic (metres) on a 1737.4 km sphere, and
pixel values are heights in metres above that sphere (PGDA README).
"""
from pathlib import Path

import numpy as np
import rasterio
from pyproj import CRS, Transformer

ROOT = Path(__file__).resolve().parents[1]
DEM_DIR = ROOT / "raw" / "dem"
MOSAIC = ROOT / "raw" / "mosaic" / "ldem_87s_5mpp.tif"
MOON_LONLAT = CRS.from_proj4("+proj=longlat +R=1737400 +no_defs")


def site_dem_path(site):
    return DEM_DIR / f"{site}_final_adj_5mpp_surf.tif"


class Dem:
    """A height grid held in memory, with bilinear lookup in map coordinates."""

    def __init__(self, z, x_ul, y_ul, res, crs):
        # x_ul, y_ul: outer corner of the top left pixel; res: pixel size (m)
        self.z = np.asarray(z, dtype=np.float32)
        self.x_ul, self.y_ul, self.res = float(x_ul), float(y_ul), float(res)
        self.crs = CRS.from_user_input(crs)
        self._to_xy = Transformer.from_crs(MOON_LONLAT, self.crs, always_xy=True)
        self._to_ll = Transformer.from_crs(self.crs, MOON_LONLAT, always_xy=True)

    @classmethod
    def open(cls, path, overview_level=None):
        """Read a GeoTIFF. overview_level k reads the file's built in
        reduced copy (k=0 is 2x coarser, k=3 is 16x) without decompressing
        the full resolution data."""
        kw = {} if overview_level is None else {"overview_level": overview_level}
        with rasterio.open(path, **kw) as src:
            t = src.transform
            assert abs(t.a + t.e) < 1e-6 and t.b == 0 and t.d == 0, "expect square, north-up pixels"
            return cls(src.read(1), t.c, t.f, t.a, src.crs.to_wkt())

    @property
    def shape(self):
        return self.z.shape

    def xy(self, lat, lon):
        return self._to_xy.transform(lon, lat)

    def latlon(self, x, y):
        lon, lat = self._to_ll.transform(x, y)
        return lat, lon

    def rowcol(self, x, y):
        """Fractional row/col where integer values are pixel centres."""
        col = (np.asarray(x) - self.x_ul) / self.res - 0.5
        row = (self.y_ul - np.asarray(y)) / self.res - 0.5
        return row, col

    def height(self, x, y):
        """Bilinear height at map points; NaN outside the grid or on nodata."""
        row, col = self.rowcol(x, y)
        ny, nx = self.z.shape
        r0 = np.floor(row).astype(np.int64)
        c0 = np.floor(col).astype(np.int64)
        inside = (r0 >= 0) & (c0 >= 0) & (r0 < ny - 1) & (c0 < nx - 1)
        r0c = np.where(inside, r0, 0)
        c0c = np.where(inside, c0, 0)
        fr = row - r0
        fc = col - c0
        z = self.z
        h = ((1 - fr) * (1 - fc) * z[r0c, c0c] + (1 - fr) * fc * z[r0c, c0c + 1]
             + fr * (1 - fc) * z[r0c + 1, c0c] + fr * fc * z[r0c + 1, c0c + 1])
        return np.where(inside, h, np.nan)

    def highest_point(self, half_width_m):
        """Highest pixel within a square of +/- half_width_m around the centre."""
        ny, nx = self.z.shape
        k = int(half_width_m / self.res)
        sub = self.z[ny // 2 - k: ny // 2 + k, nx // 2 - k: nx // 2 + k]
        r, c = np.unravel_index(np.nanargmax(sub), sub.shape)
        r += ny // 2 - k
        c += nx // 2 - k
        x = self.x_ul + (c + 0.5) * self.res
        y = self.y_ul - (r + 0.5) * self.res
        return x, y, float(self.z[r, c])


def site_dem(site):
    return Dem.open(site_dem_path(site))
