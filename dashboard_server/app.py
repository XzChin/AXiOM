"""python -m dashboard_server.app   ->  http://127.0.0.1:8080  (needs the graded server on port 8000)"""
from pydantic import BaseModel
import uvicorn
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.staticfiles import StaticFiles

from dashboard_server import analysis, core

app = FastAPI()


class CertificateReq(BaseModel):
    init_states: list
    doy_sincos: list[float]
    perturbation: list
    steps: int = 10


class EnsembleReq(BaseModel):
    init_states: list
    doy_sincos: list[float]
    steps: int = 10
    members: int = 5
    noise_scale: float = 0.05


class SensitivityReq(BaseModel):
    init_states: list
    doy_sincos: list[float]
    target_channel: int = 1
    target_day: int = 4
    region_id: str = "central_monsoon"


class ReverseReq(BaseModel):
    init_states: list
    doy_sincos: list[float]
    target_region: str = "central_monsoon"
    target_day: int = 5
    target_channel: int = 1
    direction: str = "increase"


class MemoryReq(BaseModel):
    init_states: list
    doy_sincos: list[float]
    perturbation: list
    recovery_day: int = 3
    total_days: int = 10
    comp_scale: float = 1.0


@app.post("/api/model/{route}")
async def proxy(route: str, request: Request):
    if route not in ("health", "simulate"):
        raise HTTPException(404)
    from starlette.concurrency import run_in_threadpool
    status, body = await run_in_threadpool(core.forward, route, await request.body())
    return Response(body, status_code=status, media_type="application/json")


@app.get("/api/meta")
def meta():
    return core.meta()


@app.get("/api/sample-windows")
def sample_windows():
    return core.sample_windows()


@app.get("/api/window")
def window(date: str):
    try:
        return core.window(date)
    except ValueError as e:
        raise HTTPException(422, str(e)) from None


@app.post("/api/analysis/certificate")
def api_certificate(req: CertificateReq):
    try:
        return analysis.run_certificate(req.init_states, req.doy_sincos, req.perturbation, req.steps)
    except ValueError as e:
        raise HTTPException(422, str(e)) from None


@app.post("/api/analysis/ensemble")
def api_ensemble(req: EnsembleReq):
    try:
        return analysis.run_ensemble(req.init_states, req.doy_sincos, req.steps, req.members, req.noise_scale)
    except ValueError as e:
        raise HTTPException(422, str(e)) from None


@app.post("/api/analysis/sensitivity")
def api_sensitivity(req: SensitivityReq):
    try:
        return analysis.run_sensitivity(req.init_states, req.doy_sincos, req.target_channel, req.target_day, req.region_id)
    except ValueError as e:
        raise HTTPException(422, str(e)) from None


@app.post("/api/analysis/reverse")
def api_reverse(req: ReverseReq):
    try:
        return analysis.run_reverse_simulator(req.init_states, req.doy_sincos, req.target_region, req.target_day, req.target_channel, req.direction)
    except ValueError as e:
        raise HTTPException(422, str(e)) from None


@app.post("/api/analysis/memory")
def api_memory(req: MemoryReq):
    try:
        return analysis.run_memory_lab(req.init_states, req.doy_sincos, req.perturbation, req.recovery_day, req.total_days, req.comp_scale)
    except ValueError as e:
        raise HTTPException(422, str(e)) from None


app.mount("/", StaticFiles(directory=core.ROOT / "frontend" / "dist", html=True))

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8080)
