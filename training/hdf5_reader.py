"""Read the kit NetCDF4 file. Uses xarray when installed; otherwise calls the system libhdf5 through ctypes."""
import ctypes as C
import ctypes.util
import numpy as np


def _read_ctypes(path, names):
    lib = C.CDLL(ctypes.util.find_library("hdf5_serial") or ctypes.util.find_library("hdf5"))
    hid = C.c_int64
    lib.H5open()
    lib.H5Fopen.restype = hid; lib.H5Fopen.argtypes = [C.c_char_p, C.c_uint, hid]
    lib.H5Dopen2.restype = hid; lib.H5Dopen2.argtypes = [hid, C.c_char_p, hid]
    lib.H5Dget_space.restype = hid; lib.H5Dget_space.argtypes = [hid]
    lib.H5Sget_simple_extent_ndims.argtypes = [hid]
    lib.H5Sget_simple_extent_dims.argtypes = [hid, C.c_void_p, C.c_void_p]
    lib.H5Dread.argtypes = [hid, hid, hid, hid, hid, C.c_void_p]
    lib.H5Dclose.argtypes = [hid]; lib.H5Fclose.argtypes = [hid]
    f32 = hid.in_dll(lib, "H5T_NATIVE_FLOAT_g").value
    f = lib.H5Fopen(str(path).encode(), 0, 0)
    if f < 0:
        raise OSError(f"cannot open {path}")
    out = {}
    for n in names:
        d = lib.H5Dopen2(f, n.encode(), 0)
        if d < 0:
            raise KeyError(n)
        s = lib.H5Dget_space(d)
        nd = lib.H5Sget_simple_extent_ndims(s)
        dims = (C.c_uint64 * nd)()
        lib.H5Sget_simple_extent_dims(s, dims, None)
        a = np.empty(tuple(dims), np.float32)
        if lib.H5Dread(d, f32, 0, 0, 0, a.ctypes.data_as(C.c_void_p)) < 0:
            raise OSError(f"read failed: {n}")
        out[n] = a
        lib.H5Dclose(d)
    lib.H5Fclose(f)
    return out


def load(path):
    """Return (data [N,6,32,36], static [2,32,36], time float array, lat, lon)."""
    try:
        import xarray as xr
    except ImportError:
        r = _read_ctypes(path, ["data", "static", "time", "lat", "lon"])
        return r["data"], r["static"], r["time"], r["lat"], r["lon"]
    with xr.open_dataset(path, decode_times=False) as ds:
        return tuple(np.asarray(ds[n].values, np.float32) for n in ["data", "static", "time", "lat", "lon"])
