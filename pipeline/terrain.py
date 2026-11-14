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

    def local_axes(self, x, y):
        """Unit vectors of local north and east on the map, found numerically
        (nudge latitude, then longitude, and see which way the point moves)."""
        lat, lon = self.latlon(x, y)
        xn, yn = self.xy(lat + 1e-4, lon)
        north = np.array([xn - x, yn - y])
        north /= np.linalg.norm(north)
        xe, ye = self.xy(lat, lon + 1e-4)
        east = np.array([xe - x, ye - y])
        east /= np.linalg.norm(east)
        # conformal map: east must be north turned 90 degrees clockwise
        assert np.allclose(east, [north[1], -north[0]], atol=1e-6), (north, east)
        return north, east

    def slope(self, x, y, half_px=2):
        """Slope (degrees) and the azimuth the slope faces (downhill direction,
        degrees clockwise from north), from a least squares plane fitted to the
        (2 half_px + 1)^2 pixels around the point (default 5 x 5 pixels, 25 m
        across, roughly lander sized)."""
        row, col = self.rowcol(x, y)
        r, c = int(round(float(row))), int(round(float(col)))
        k = half_px
        win = self.z[r - k: r + k + 1, c - k: c + k + 1].astype(float)
        dy_idx, dx_idx = np.mgrid[-k: k + 1, -k: k + 1]
        A = np.column_stack([dx_idx.ravel() * self.res,          # +x (east on map)
                             -dy_idx.ravel() * self.res,         # +y (rows go down)
                             np.ones(win.size)])
        ok = np.isfinite(win.ravel())
        (gx, gy, _), *_ = np.linalg.lstsq(A[ok], win.ravel()[ok], rcond=None)
        slope = float(np.degrees(np.arctan(np.hypot(gx, gy))))
        north, east = self.local_axes(x, y)
        down = -np.array([gx, gy])  # map direction of steepest descent
        facing = float(np.degrees(np.arctan2(down @ east, down @ north)) % 360.0)
        return slope, facing

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


POLAR_240 = ROOT / "raw" / "polar" / "ldem_75s_240m.lbl"
_polar_cache = []


def polar_dem():
    """LOLA LDEM_75S_240M (75-90 S, 240 m, MOON_ME of DE421). Stored as int16
    DN with height = 0.5 * DN metres above the 1737.4 km sphere. GDAL also
    reports an offset of 1737400 m; that would give radius, so it is not
    applied."""
    if not _polar_cache:
        with rasterio.open(POLAR_240) as src:
            dn = src.read(1)
            t = src.transform
            z = np.where(dn == src.nodata, np.nan, dn.astype(np.float32) * 0.5)
            _polar_cache.append(Dem(z, t.c, t.f, t.a, src.crs.to_wkt()))
    return _polar_cache[0]


_mosaic_cache = {}


def mosaic_dem(factor=16):
    """The 87-90 S mosaic at a reduced resolution, read from the file's built in
    overviews: factor 2, 4, 8 or 16 gives 10, 20, 40 or 80 m pixels."""
    if factor not in _mosaic_cache:
        level = {2: 0, 4: 1, 8: 2, 16: 3}[factor]
        _mosaic_cache[factor] = Dem.open(MOSAIC, overview_level=level)
    return _mosaic_cache[factor]


def read_rois(site):
    """Barker et al. (2021) regions of interest for a site, read straight from
    the shapefile (polygon records) and its .dbf table. Returns a list of
    {attributes..., "area_m2", "cx", "cy"} with the area weighted polygon
    centroid in map metres."""
    import struct
    base = DEM_DIR / "rois" / site / f"{site}_ROIs"
    # .dbf attribute table
    raw = (base.with_suffix(".dbf")).read_bytes()
    n_rec, hdr_len, rec_len = struct.unpack("<IHH", raw[4:12])
    fields, pos = [], 32
    while raw[pos] != 0x0D:
        name = raw[pos:pos + 11].split(b"\0")[0].decode()
        fields.append((name, raw[pos + 16]))
        pos += 32
    rows = []
    for i in range(n_rec):
        rec = raw[hdr_len + i * rec_len + 1: hdr_len + (i + 1) * rec_len]
        row, p = {}, 0
        for name, flen in fields:
            v = rec[p:p + flen].decode(errors="replace").strip()
            try:
                v = float(v)
            except ValueError:
                pass
            row[name] = v
            p += flen
        rows.append(row)
    # .shp polygons
    shp = (base.with_suffix(".shp")).read_bytes()
    pos, k = 100, 0
    while pos < len(shp):
        _, length = struct.unpack(">ii", shp[pos:pos + 8])
        c = shp[pos + 8: pos + 8 + 2 * length]
        pos += 8 + 2 * length
        if struct.unpack("<i", c[:4])[0] != 5:
            continue
        n_parts, n_pts = struct.unpack("<ii", c[36:44])
        parts = list(struct.unpack(f"<{n_parts}i", c[44:44 + 4 * n_parts])) + [n_pts]
        pts = np.frombuffer(c[44 + 4 * n_parts: 44 + 4 * n_parts + 16 * n_pts], "<f8").reshape(-1, 2)
        A = cx = cy = 0.0
        for a, b in zip(parts[:-1], parts[1:]):
            x, y = pts[a:b, 0], pts[a:b, 1]
            cr = x[:-1] * y[1:] - x[1:] * y[:-1]
            A += cr.sum() / 2
            cx += ((x[:-1] + x[1:]) * cr).sum() / 6
            cy += ((y[:-1] + y[1:]) * cr).sum() / 6
        rows[k].update(area_m2=abs(A), cx=cx / A, cy=cy / A)
        k += 1
    return rows
