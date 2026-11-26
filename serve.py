"""Graded server.  python serve.py --port 8000   (POST /health, POST /simulate)"""
import argparse

import uvicorn
from fastapi import FastAPI, HTTPException

from api.core import MODEL_NAME, Engine, SimulateRequest

app = FastAPI()
engine = Engine()          # loads weights and warms up before the server accepts requests


@app.post("/health")
def health():
    return {"status": "ready", "model_name": MODEL_NAME}


@app.post("/simulate")
def simulate(req: SimulateRequest):
    try:
        return engine.simulate(req)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from None


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8000)
    uvicorn.run(app, host="0.0.0.0", port=ap.parse_args().port, log_level="warning")
