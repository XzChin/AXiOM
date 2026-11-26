"""MonsoonNet-lite: a local residual MLP applied to every grid cell (equivalent to a 5x5 convolution followed
by 1x1 layers), implemented in NumPy. Shared by training, evaluation and serving."""
import numpy as np

NC, H, W = 6, 32, 36
N = H * W
RADIUS = 2            # per-step receptive radius in cells
LIMIT = 4.0           # tendency bound, in units of tendency std
ANOM_CLIP = np.array([6.0, 1.9, 6.0, 6.0, 6.0, 5.0], np.float32)  # per-cell bound on normalised anomalies
LAT = np.arange(6.5, 38.0, 1.0)
LON = np.arange(65.5, 101.0, 1.0)


def _neighbours(r):
    i, j = np.divmod(np.arange(N), W)
    return np.stack([np.clip(i + di, 0, H - 1) * W + np.clip(j + dj, 0, W - 1)
                     for di in range(-r, r + 1) for dj in range(-r, r + 1)], axis=1)


NB5 = _neighbours(2)                                              # [N,25]
SEL3 = np.array([r * 5 + c for r in (1, 2, 3) for c in (1, 2, 3)])  # inner 3x3 of the 5x5 patch
NB3 = NB5[:, SEL3]


def harmonics(doy, k=3):
    a = 2 * np.pi * np.atleast_1d(np.asarray(doy, np.float64)) / 365.25
    cols = [np.ones_like(a)]
    for h in range(1, k + 1):
        cols += [np.cos(h * a), np.sin(h * a)]
    return np.stack(cols, 1).astype(np.float32)                   # [T,7]


def to_model_space(x):
    y = np.array(x, np.float32, copy=True)
    y[..., 1, :, :] = np.log1p(np.maximum(y[..., 1, :, :], 0))
    return y


def static_features(static):
    lsm, oro = static[0].astype(np.float32), static[1].astype(np.float32)
    gy, gx = np.gradient(oro / 1000.0)
    lat = np.repeat(((LAT - 22) / 16)[:, None], W, 1)
    lon = np.repeat(((LON - 83) / 18)[None], H, 0)
    return np.stack([lsm, oro / 3000.0, gx, gy, lat, lon]).reshape(6, N).T.astype(np.float32)


N_FEATURES = 25 * NC + 9 * NC + NC + 6 + 1 + 2


class Net:
    def __init__(self, artifacts):
        self.a = artifacts
        self.static = artifacts["static_features"]
        self.n_layers = sum(1 for k in artifacts if k.startswith("w") and k[1:].isdigit())

    @classmethod
    def load(cls, path):
        with np.load(path, allow_pickle=False) as z:
            return cls({k: z[k] for k in z.files})

    def climatology(self, doy):
        """[T,N,6] in model space (rain is log1p)."""
        return np.einsum("th,hcn->tnc", harmonics(doy), self.a["clim_coef"], optimize=True)

    def features(self, z0, z1, z2, doy, cells=None):
        """z*: [B,N,6] normalised anomalies, oldest first. Returns [B*N,F]."""
        B = z2.shape[0]
        p = z2[:, NB5].reshape(B * N, 25 * NC)
        d1 = (z2 - z1)[:, NB3].reshape(B * N, 9 * NC)
        d0 = (z1 - z0).reshape(B * N, NC)
        st = np.broadcast_to(self.static, (B, N, 6)).reshape(B * N, 6)
        wind = (z2[..., 2] * self.static[:, 2] + z2[..., 3] * self.static[:, 3]).reshape(B * N, 1)
        a = 2 * np.pi * np.asarray(doy, np.float32) / 365.0
        season = np.repeat(np.stack([np.sin(a), np.cos(a)], 1), N, 0)
        return np.concatenate([p, d1, d0, st, wind, season], 1).astype(np.float32)

    def forward(self, x, keep=False):
        h, cache = x, [x]
        for i in range(self.n_layers - 1):
            h = np.maximum(h @ self.a[f"w{i}"] + self.a[f"b{i}"], 0)
            cache.append(h)
        i = self.n_layers - 1
        raw = h @ self.a[f"w{i}"] + self.a[f"b{i}"] + x @ self.a["skip"]
        out = LIMIT * np.tanh(raw / LIMIT)
        return (out, cache) if keep else out

    def rollout(self, init, doy, steps):
        """init [3,6,32,36] physical; doy = day of year of init[-1]. Returns [steps,6,32,36] physical."""
        a = self.a
        days = np.array([doy - 2, doy - 1, doy], np.float32)
        clim = self.climatology(days)
        s = to_model_space(init).reshape(3, NC, N).transpose(0, 2, 1)
        z = [((s[k] - clim[k]) / a["anom_std"])[None].astype(np.float32) for k in range(3)]
        out = np.empty((steps, NC, H, W), np.float32)
        for k in range(steps):
            cur = doy + k
            tend = self.forward(self.features(z[0], z[1], z[2], [cur]))
            nxt = z[2] + (tend[None] * a["tend_std"] + a["tend_mean"]) / a["anom_std"]
            nxt = np.clip(nxt, -ANOM_CLIP, ANOM_CLIP)
            c = self.climatology([cur + 1])[0]
            y = nxt[0] * a["anom_std"] + c
            y[:, 1] = np.clip(y[:, 1], 0, np.log1p(400.0))        # rain: non-negative and bounded
            y[:, 5] = np.maximum(y[:, 5], 0)
            nxt = ((y - c) / a["anom_std"])[None].astype(np.float32)
            phys = y.copy()
            phys[:, 1] = np.maximum(np.expm1(y[:, 1]) * a["rain_scale"], 0)
            out[k] = phys.T.reshape(NC, H, W)
            z = [z[1], z[2], nxt]
        return out
