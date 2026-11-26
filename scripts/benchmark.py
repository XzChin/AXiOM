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
def _peak_rss_mb():
    try:
        import resource
        return resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024
    except ImportError:
        try:
            import ctypes
            from ctypes import wintypes

            class PROCESS_MEMORY_COUNTERS(ctypes.Structure):
                _fields_ = [
                    ("cb", wintypes.DWORD),
                    ("PageFaultCount", wintypes.DWORD),
                    ("PeakWorkingSetSize", ctypes.c_size_t),
                    ("WorkingSetSize", ctypes.c_size_t),
                    ("QuotaPeakPagedPoolUsage", ctypes.c_size_t),
                    ("QuotaPagedPoolUsage", ctypes.c_size_t),
                    ("QuotaPeakNonPagedPoolUsage", ctypes.c_size_t),
                    ("QuotaNonPagedPoolUsage", ctypes.c_size_t),
                    ("PagefileUsage", ctypes.c_size_t),
                    ("PeakPagefileUsage", ctypes.c_size_t),
                ]

            pmc = PROCESS_MEMORY_COUNTERS()
            pmc.cb = ctypes.sizeof(PROCESS_MEMORY_COUNTERS)
            h = ctypes.windll.kernel32.GetCurrentProcess()
            if ctypes.windll.psapi.GetProcessMemoryInfo(h, ctypes.byref(pmc), pmc.cb):
                return pmc.PeakWorkingSetSize / (1024 * 1024)
        except Exception:
            pass
    return None


rss = _peak_rss_mb()
print(f"peak RSS {rss:.0f} MB" if rss is not None else "peak memory: not measured on this OS")
