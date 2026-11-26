"""Train MonsoonNet-lite in NumPy.  Stage A: one-step Huber on sampled cells. Stage B: multi-step rollout (BPTT).
Usage: python training/train.py --data PATH/india_climate_train.nc --out weights/model.npz"""
import argparse, json, sys, time
from pathlib import Path
import numpy as np
from scipy import sparse

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / "src"), str(Path(__file__).parent)]
from hdf5_reader import load
from monsoon.model import Net, N, NC, NB5, SEL3, LIMIT, N_FEATURES, harmonics, to_model_space, static_features

START = np.datetime64("2005-01-01")


def calendar(n):
    d = START + np.arange(n)
    years = d.astype("datetime64[Y]")
    return years.astype(int) + 1970, (d - years.astype("datetime64[D]")).astype(int) + 1


def prepare(path, train_end):
    data, static, *_ = load(path)
    years, doy = calendar(len(data))
    tr = np.where(years <= train_end)[0]
    y = to_model_space(data).reshape(len(data), NC, N)
    X = harmonics(doy)
    coef = np.linalg.lstsq(X[tr], y[tr].reshape(len(tr), -1), rcond=None)[0].reshape(7, NC, N).astype(np.float32)
    anom = (y - np.einsum("th,hcn->tcn", X, coef, optimize=True)).transpose(0, 2, 1)
    std = anom[tr].std((0, 1)).astype(np.float32)
    z = (anom / std).astype(np.float32)
    inner = tr[1:][np.diff(tr) == 1]
    tend = (z[inner] - z[inner - 1]) * std
    art = dict(clim_coef=coef, anom_std=std, tend_mean=tend.mean((0, 1)).astype(np.float32),
               tend_std=tend.std((0, 1)).astype(np.float32), static_features=static_features(static),
               rain_scale=np.float32(1.3))
    return data, z, doy, years, art


class Adam:
    def __init__(self, params, wd=1e-4):
        self.p, self.wd, self.t = params, wd, 0
        self.m = {k: np.zeros_like(v) for k, v in params.items()}
        self.v = {k: np.zeros_like(v) for k, v in params.items()}

    def step(self, g, lr):
        self.t += 1
        norm = np.sqrt(sum(float((x * x).sum()) for x in g.values()))
        clip = min(1.0, 1.0 / (norm + 1e-9))
        for k, p in self.p.items():
            gk = g[k] * clip
            self.m[k] = 0.9 * self.m[k] + 0.1 * gk
            self.v[k] = 0.99 * self.v[k] + 0.01 * gk * gk
            mh, vh = self.m[k] / (1 - 0.9 ** self.t), self.v[k] / (1 - 0.99 ** self.t)
            p -= lr * (mh / (np.sqrt(vh) + 1e-8) + (self.wd * p if p.ndim == 2 else 0))


def backward(net, cache, out, dout, grads, need_input):
    """Backpropagate d(loss)/d(out) through the MLP; accumulates into grads, optionally returns d/d(input)."""
    a, L = net.a, net.n_layers
    g = dout * (1 - (out / LIMIT) ** 2)
    x = cache[0]
    grads["skip"] += x.T @ g
    gskip = g @ a["skip"].T if need_input else None
    for i in range(L - 1, -1, -1):
        grads[f"w{i}"] += cache[i].T @ g
        grads[f"b{i}"] += g.sum(0)
        if i == 0 and not need_input:
            return None
        g = g @ a[f"w{i}"].T
        if i > 0:
            g *= cache[i] > 0
    return g + gskip


def huber(e, d=1.0):
    ae = np.abs(e)
    return np.where(ae < d, 0.5 * e * e, d * (ae - 0.5 * d)), np.clip(e, -d, d)


def init_params(rng, width):
    sizes = [N_FEATURES, width, width, NC]
    p = {}
    for i in range(3):
        p[f"w{i}"] = (rng.standard_normal((sizes[i], sizes[i + 1])) * np.sqrt(2 / sizes[i])).astype(np.float32)
        p[f"b{i}"] = np.zeros(sizes[i + 1], np.float32)
    p["w2"] *= 0.05
    p["skip"] = np.zeros((N_FEATURES, NC), np.float32)
    return p


def sample_cells(net, z, doy, t, c):
    p = z[t[:, None], NB5[c]]                                     # [B,25,6]
    z2, z1, z0 = z[t, c], z[t - 1, c], z[t - 2, c]
    d1 = (p - z[(t - 1)[:, None], NB5[c]])[:, SEL3]
    st = net.static[c]
    a = 2 * np.pi * doy[t].astype(np.float32) / 365.0
    return np.concatenate([p.reshape(len(t), -1), d1.reshape(len(t), -1), z1 - z0, st,
                           (z2[:, 2] * st[:, 2] + z2[:, 3] * st[:, 3])[:, None], np.sin(a)[:, None], np.cos(a)[:, None]],
                          1).astype(np.float32)


def gather_matrix(nb):
    k = nb.shape[1]
    return sparse.csr_matrix((np.ones(N * k, np.float32), (np.arange(N * k), nb.ravel())), shape=(N * k, N))


G5T = gather_matrix(NB5).T.tocsr()
G3T = gather_matrix(NB5[:, SEL3]).T.tocsr()


def scatter(GT, g, B, k):
    """Adjoint of z[:, nb] : g [B*N, k*6] -> [B,N,6]."""
    return np.stack([GT @ g[b * N:(b + 1) * N].reshape(N * k, NC) for b in range(B)])


def paired_shock_penalty(delta, weight, horizon, threshold=4.0):
    """Mean squared hinge penalty and d(loss)/d(delta)."""
    over = np.maximum(np.abs(delta) - threshold, 0.0) * np.sign(delta)
    loss = weight * float(np.mean(over * over)) / horizon
    grad = (2.0 * weight * over / (over.size * horizon)).astype(np.float32)
    return loss, grad


def rollout_train_step(
    net,
    opt,
    z,
    doy,
    t0,
    horizon,
    lr,
    grad_weight=0.0,
    heavy_rain_weight=0.0,
    shock_weight=0.0,
    rng=None,
):
    """Multi-step BPTT with optional Stage C (spatial gradient + heavy-rain) and Stage D (shock locality/bound) terms."""
    a = net.a
    B = len(t0)
    states = [z[t0 - 2], z[t0 - 1], z[t0]]
    ratio, shift = a["tend_std"] / a["anom_std"], a["tend_mean"] / a["anom_std"]
    caches, dloss, total = [], [], 0.0
    for k in range(horizon):
        x = net.features(states[k], states[k + 1], states[k + 2], doy[t0 + k])
        out, cache = net.forward(x, keep=True)
        nxt = states[k + 2] + out.reshape(B, N, NC) * ratio + shift
        states.append(nxt)
        err = nxt - z[t0 + k + 1]
        l, g = huber(err)
        if heavy_rain_weight > 0:
            w = np.ones_like(err)
            w[..., 1] += heavy_rain_weight * np.maximum(z[t0 + k + 1, :, 1], 0.0)
            l = l * w
            g = g * w
        if grad_weight > 0:
            grid_e = err.reshape(B, 32, 36, NC)
            dx = np.zeros_like(grid_e)
            dy = np.zeros_like(grid_e)
            dx[:, :, :-1] = grid_e[:, :, 1:] - grid_e[:, :, :-1]
            dy[:, :-1, :] = grid_e[:, 1:, :] - grid_e[:, :-1, :]
            g_sp = np.zeros_like(grid_e)
            g_sp[:, :, :-1] -= dx[:, :, :-1]
            g_sp[:, :, 1:] += dx[:, :, :-1]
            g_sp[:, :-1, :] -= dy[:, :-1, :]
            g_sp[:, 1:, :] += dy[:, :-1, :]
            total += grad_weight * float((dx * dx + dy * dy).mean()) / horizon
            g = g + grad_weight * g_sp.reshape(B, N, NC)
        total += l.mean() / horizon
        dloss.append(g / (g.size * horizon))
        caches.append((cache, out))

    # Stage D paired shock stability/boundedness penalty
    s_dloss = []
    if shock_weight > 0 and rng is not None:
        shock = np.zeros_like(states[2])
        ci = rng.integers(0, NC)
        cy, cx = rng.integers(4, 28), rng.integers(4, 32)
        ii, jj = np.indices((32, 36))
        mask = (np.exp(-((ii - cy) ** 2 + (jj - cx) ** 2) / (2 * 2.5 ** 2))).reshape(N)
        shock[:, :, ci] = rng.choice([-1.0, 1.0]) * 1.5 * mask[None, :]
        s_states = [states[0], states[1], states[2] + shock]
        s_caches = []
        for k in range(horizon):
            sx = net.features(s_states[k], s_states[k + 1], s_states[k + 2], doy[t0 + k])
            sout, scache = net.forward(sx, keep=True)
            snxt = s_states[k + 2] + sout.reshape(B, N, NC) * ratio + shift
            s_states.append(snxt)
            delta = snxt - states[k + 3]
            penalty, ddelta = paired_shock_penalty(delta, shock_weight, horizon)
            total += penalty
            s_dloss.append(ddelta)
            s_caches.append((scache, sout))

    grads = {k: np.zeros_like(v) for k, v in opt.p.items()}
    o = 150

    # First backpropagate the shocked branch. Its first three states
    # are shared with the baseline branch and must pass gradients back.
    shared_initial_adj = [np.zeros_like(states[0]) for _ in range(3)]

    if s_dloss:
        s_adj = [np.zeros_like(s_states[0]) for _ in s_states]

        for k in range(horizon - 1, -1, -1):
            s_adj[k + 3] += s_dloss[k]
            ga = s_adj[k + 3]
            s_adj[k + 2] += ga

            scache, sout = s_caches[k]
            sgx = backward(
                net, scache, sout,
                (ga * ratio).reshape(B * N, NC).astype(np.float32),
                grads, True
            )

            sgp = scatter(G5T, sgx[:, :o], B, 25)
            sgd1 = scatter(G3T, sgx[:, o:o + 54], B, 9)
            sgd0 = sgx[:, o + 54:o + 60].reshape(B, N, NC)
            sgw = sgx[:, o + 66].reshape(B, N)

            s_adj[k + 2] += sgp + sgd1
            s_adj[k + 2][..., 2] += sgw * net.static[:, 2]
            s_adj[k + 2][..., 3] += sgw * net.static[:, 3]
            s_adj[k + 1] += sgd0 - sgd1
            s_adj[k] -= sgd0

        for k in range(3):
            shared_initial_adj[k] += s_adj[k]

    # Then backpropagate the baseline branch. The paired objective
    # contributes -dL/d(delta) to each baseline forecast state.
    adj = [np.zeros_like(states[0]) for _ in states]

    for k in range(3):
        adj[k] += shared_initial_adj[k]

    for k in range(horizon - 1, -1, -1):
        adj[k + 3] += dloss[k]

        if s_dloss:
            adj[k + 3] -= s_dloss[k]

        ga = adj[k + 3]
        adj[k + 2] += ga

        cache, out = caches[k]
        gx = backward(
            net, cache, out,
            (ga * ratio).reshape(B * N, NC).astype(np.float32),
            grads, True
        )

        gp = scatter(G5T, gx[:, :o], B, 25)
        gd1 = scatter(G3T, gx[:, o:o + 54], B, 9)
        gd0 = gx[:, o + 54:o + 60].reshape(B, N, NC)
        gw = gx[:, o + 66].reshape(B, N)

        adj[k + 2] += gp + gd1
        adj[k + 2][..., 2] += gw * net.static[:, 2]
        adj[k + 2][..., 3] += gw * net.static[:, 3]
        adj[k + 1] += gd0 - gd1
        adj[k] -= gd0

    opt.step(grads, lr)
    return float(total)


def fit(net, z, doy, years, train_end, iters_a, stage_b, seed=0, stage_c_iters=0, stage_d_iters=0):
    rng = np.random.default_rng(seed)
    a = net.a
    params = {k: a[k] for k in a if k == "skip" or (k[0] in "wb" and k[1:].isdigit())}
    valid = np.where(years <= train_end)[0]
    opt, t0 = Adam(params), time.time()
    for it in range(iters_a):
        t = rng.integers(2, valid[-1], 768)
        c = rng.integers(0, N, 768)
        x = sample_cells(net, z, doy, t, c)
        target = ((z[t + 1, c] - z[t, c]) * a["anom_std"] - a["tend_mean"]) / a["tend_std"]
        out, cache = net.forward(x, keep=True)
        l, g = huber(out - target)
        grads = {k: np.zeros_like(v) for k, v in params.items()}
        backward(net, cache, out, (g / g.size).astype(np.float32), grads, False)
        opt.step(grads, 1.5e-3 * 0.5 * (1 + np.cos(np.pi * it / iters_a)) + 2e-5)
        if it % 1000 == 0:
            print(f"A {it} loss {l.mean():.4f} {time.time() - t0:.0f}s", flush=True)
    for horizon, iters, lr in stage_b:
        opt = Adam(params, wd=1e-5)
        for it in range(iters):
            starts = rng.integers(2, valid[-1] - horizon, 4)
            l = rollout_train_step(net, opt, z, doy, starts, horizon, lr * (1 - 0.7 * it / iters))
            if it % 100 == 0:
                print(f"B h={horizon} {it} loss {l:.4f} {time.time() - t0:.0f}s", flush=True)
    if stage_c_iters > 0:
        opt = Adam(params, wd=1e-5)
        for it in range(stage_c_iters):
            starts = rng.integers(2, valid[-1] - 8, 4)
            l = rollout_train_step(net, opt, z, doy, starts, 8, 8e-5, grad_weight=0.15, heavy_rain_weight=0.5)
            if it % 100 == 0:
                print(f"C {it} loss {l:.4f} {time.time() - t0:.0f}s", flush=True)
    if stage_d_iters > 0:
        opt = Adam(params, wd=1e-5)
        for it in range(stage_d_iters):
            starts = rng.integers(2, valid[-1] - 8, 4)
            l = rollout_train_step(net, opt, z, doy, starts, 8, 6e-5, shock_weight=0.25, rng=rng)
            if it % 100 == 0:
                print(f"D {it} loss {l:.4f} {time.time() - t0:.0f}s", flush=True)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True)
    ap.add_argument("--out", default=str(ROOT / "weights/model.npz"))
    ap.add_argument("--train-end", type=int, default=2017)
    ap.add_argument("--iters", type=int, default=12000)
    ap.add_argument("--rollout", default="2:500:3e-4,4:500:2e-4,8:400:1e-4", help="horizon:iterations:lr,...")
    ap.add_argument("--stage-c", type=int, default=0, help="Stage C sharpness/heavy-rain iterations")
    ap.add_argument("--stage-d", type=int, default=0, help="Stage D shock fine-tune iterations")
    ap.add_argument("--width", type=int, default=128)
    ap.add_argument("--seed", type=int, default=0)
    args = ap.parse_args()
    data, z, doy, years, art = prepare(args.data, args.train_end)
    art.update(init_params(np.random.default_rng(args.seed), args.width))
    net = Net(art)
    plan = [(int(h), int(i), float(l)) for h, i, l in (s.split(":") for s in args.rollout.split(",") if s)]
    fit(net, z, doy, years, args.train_end, args.iters, plan, args.seed, args.stage_c, args.stage_d)
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(args.out, **net.a)
    meta = {k: getattr(args, k) for k in ("train_end", "iters", "rollout", "width", "seed")}
    meta["data_start"] = str(START)
    Path(args.out).with_suffix(".json").write_text(json.dumps(meta, indent=1))
    print("saved", args.out)
