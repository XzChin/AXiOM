"""python -m dashboard_server.app   ->  http://127.0.0.1:8080  (needs the graded server on port 8000)"""
import uvicorn
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.staticfiles import StaticFiles

from dashboard_server import core

app = FastAPI()


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


@app.get("/api/window")
def window(date: str):
    try:
        return core.window(date)
    except ValueError as e:
        raise HTTPException(422, str(e)) from None


app.mount("/", StaticFiles(directory=core.ROOT / "frontend" / "dist", html=True))

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8080)
