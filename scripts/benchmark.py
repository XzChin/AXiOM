"""CPU latency and memory of a 10-step rollout (engine only). python scripts/benchmark.py"""
import sys, time
from pathlib import Path
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from api.core import Engine, SimulateRequest

t = time.perf_counter(); e = Engine(); print(f"load+warm-up {time.perf_counter() - t:.2f}s")
x = np.zeros((3, 6, 32, 36), np.float32); x[:, 0] = 298; x[:, 4] = 100800; x[:, 5] = 35
ms = []
for _ in range(20):
    t = time.perf_counter()
    e.simulate(SimulateRequest(init_states=x.tolist(), doy_sincos=[0.38, -0.925], steps=10))
    ms.append((time.perf_counter() - t) * 1000)
print(f"10 steps incl. array conversion (no HTTP/JSON): median {np.median(ms):.0f} ms, p95 {np.percentile(ms, 95):.0f} ms")
try:
    import resource
    print(f"peak RSS {resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024:.0f} MB")
except ImportError:
    print("peak memory: not measured on this OS")
