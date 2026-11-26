"""python -m dashboard_server.app   ->  http://127.0.0.1:8080  (needs the graded server on port 8000)"""
from typing import Literal
from pydantic import BaseModel, Field, model_validator
import uvicorn
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.staticfiles import StaticFiles

from dashboard_server import analysis, core

app = FastAPI()


VALID_REGIONS = Literal[
    "all_india",
    "western_ghats",
    "central_monsoon",
    "indo_gangetic",
    "northeast",
    "bay_of_bengal",
    "arabian_sea",
]



class ShockReq(BaseModel):
    init_states: list
    doy_sincos: list[float]
    scenario: Literal["warm_ocean", "monsoon_stall", "zero", "custom"] = "warm_ocean"
    channel: int | None = Field(default=None, ge=0, le=5)
    center_lat: float = Field(default=15.0, ge=6.5, le=37.5)
    center_lon: float = Field(default=88.0, ge=65.5, le=100.5)
    radius: float = Field(default=3.0, gt=0, le=20)
    amplitude: float = Field(default=2.5, ge=-100000, le=100000)
    steps: int = Field(default=10, ge=1, le=30)


class CertificateReq(BaseModel):
    init_states: list
    doy_sincos: list[float]
    perturbation: list
    steps: int = Field(default=10, ge=1, le=30)


class EnsembleReq(BaseModel):
    init_states: list
    doy_sincos: list[float]
    steps: int = Field(default=10, ge=1, le=30)
    members: int = Field(default=5, ge=3, le=9)
    noise_scale: float = Field(default=0.05, ge=0.0, le=1.0)


class SensitivityReq(BaseModel):
    init_states: list
    doy_sincos: list[float]
    target_channel: int = Field(default=1, ge=0, le=5)
    target_day: int = Field(default=4, ge=1, le=30)
    region_id: VALID_REGIONS = "central_monsoon"


class ReverseReq(BaseModel):
    init_states: list
    doy_sincos: list[float]
    target_region: VALID_REGIONS = "central_monsoon"
    target_day: int = Field(default=5, ge=1, le=30)
    target_channel: int = Field(default=1, ge=0, le=5)
    direction: Literal["increase", "decrease"] = "increase"


class MemoryReq(BaseModel):
    init_states: list
    doy_sincos: list[float]
    perturbation: list
    recovery_day: int = Field(default=3, ge=1, le=29)
    total_days: int = Field(default=10, ge=2, le=30)
    comp_scale: float = Field(default=1.0, ge=0.0, le=3.0)

    @model_validator(mode="after")
    def validate_recovery_day(self):
        if self.recovery_day >= self.total_days:
            raise ValueError("recovery_day must be less than total_days")
        return self


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



@app.post("/api/analysis/shock")
def api_shock(req: ShockReq):
    from dashboard_server import shock_engine
    try:
        return shock_engine.run_shock(
            req.init_states, req.doy_sincos, req.scenario,
            req.channel, req.center_lat, req.center_lon,
            req.radius, req.amplitude, req.steps,
        )
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




@app.post("/api/atmosphere/explore")
def atmosphere_explore(payload: dict):
    from dashboard_server import atmosphere_engine
    try:
        if "state" not in payload:
            raise ValueError("state is required.")
        return atmosphere_engine.run_explorer(
            payload["state"],
            payload.get("rollout"),
            payload.get("shocked_state"),
            payload.get("shocked_rollout"),
        )
    except ValueError as e:
        raise HTTPException(422, str(e)) from None


@app.post("/api/timeline/forecast")
def timeline_forecast(payload: dict):
    from dashboard_server import timeline_engine
    try:
        return timeline_engine.run_forecast(
            payload.get("date"), payload.get("steps", 10)
        )
    except ValueError as e:
        raise HTTPException(422, str(e)) from None


@app.post("/api/timeline/cell-series")
def timeline_cell_series(payload: dict):
    from dashboard_server import timeline_engine
    try:
        return timeline_engine.run_cell_series(
            payload.get("date"),
            payload.get("lat_index"),
            payload.get("lon_index"),
            payload.get("steps", 10),
        )
    except ValueError as e:
        raise HTTPException(422, str(e)) from None


@app.post("/api/timeline/hindcast")
def timeline_hindcast(payload: dict):
    from dashboard_server import timeline_engine
    try:
        return timeline_engine.run_hindcast(
            payload.get("date"), payload.get("steps", 10)
        )
    except ValueError as e:
        raise HTTPException(422, str(e)) from None

app.mount("/", StaticFiles(directory=core.ROOT / "frontend" / "dist", html=True))

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8080)
