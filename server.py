import asyncio
import math
import os
import struct
import subprocess
import time
import uuid
import wave
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR / "frontend"
DATA_DIR = BASE_DIR / "data"
SOURCES_DIR = DATA_DIR / "sources"
OUTPUT_DIR = DATA_DIR / "outputs"
SOURCES_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Optional external commands for real local/GPU inference:
# YUE2_INFER_CMD: command template accepting {prompt} {lyrics} {style} {seed} {out_path}
# WHISPER_CMD: command template accepting {in_path} returning recognized lyrics on stdout
YUE2_INFER_CMD = os.getenv("YUE2_INFER_CMD", "").strip()
WHISPER_CMD = os.getenv("WHISPER_CMD", "").strip()
UNLIMITED_QUOTA = 999999

app = FastAPI(title="Meet Yue2 Local Clone")

JOBS: dict[str, dict[str, Any]] = {}
COVER_JOBS: dict[str, dict[str, Any]] = {}
SOURCES: dict[str, Path] = {}


def _write_fallback_wav(path: Path, freq: float = 220.0, duration_sec: float = 6.0) -> float:
    """Write a valid PCM WAV file when no GPU inference command is configured."""
    sample_rate = 22050
    num_samples = int(sample_rate * duration_sec)
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        frames = bytearray()
        for i in range(num_samples):
            env = min(1.0, i / 2000.0) * min(1.0, (num_samples - i) / 2000.0)
            val = int(12000 * env * math.sin(2.0 * math.pi * freq * i / sample_rate))
            frames.extend(struct.pack("<h", val))
        wf.writeframes(bytes(frames))
    return duration_sec


async def _run_t2m_job(job_id: str, payload: dict[str, Any]) -> None:
    job = JOBS[job_id]
    await asyncio.sleep(0.5)
    job["status"] = "running"
    for cand in job["candidates"]:
        cand["status"] = "running"
        cand["stage"] = "composing"

    for idx, cand in enumerate(job["candidates"]):
        out_name = f"{job_id}_{idx}.wav"
        out_path = OUTPUT_DIR / out_name
        duration = 6.0

        if YUE2_INFER_CMD:
            cmd = YUE2_INFER_CMD.format(
                prompt=payload.get("prompt", ""),
                lyrics=payload.get("lyrics", ""),
                style=payload.get("style", ""),
                seed=cand.get("seed", 0),
                out_path=str(out_path),
            )
            proc = await asyncio.to_thread(subprocess.run, cmd, shell=True, capture_output=True, text=True)
            if proc.returncode != 0 or not out_path.exists():
                cand["status"] = "failed"
                cand["stage"] = "failed"
                continue
        else:
            duration = _write_fallback_wav(out_path, freq=220.0 + idx * 55.0, duration_sec=6.0)

        cand["status"] = "succeeded"
        cand["stage"] = "done"
        cand["result"] = {"audio_url": f"/api/audio/{out_name}", "duration": duration}
        job["completed_count"] += 1

    if job["completed_count"] == len(job["candidates"]):
        job["status"] = "succeeded"
    elif job["completed_count"] > 0:
        job["status"] = "partial_failed"
    else:
        job["status"] = "failed"


async def _run_cover_job(job_id: str, payload: dict[str, Any]) -> None:
    job = COVER_JOBS[job_id]
    for stage in ("transcribing_score", "submitting_generation", "generating"):
        job["stage"] = stage
        await asyncio.sleep(0.5)

    candidates = []
    for idx in range(2):
        out_name = f"{job_id}_{idx}.wav"
        out_path = OUTPUT_DIR / out_name
        if YUE2_INFER_CMD:
            cmd = YUE2_INFER_CMD.format(
                prompt=payload.get("music_description", ""),
                lyrics=payload.get("lyrics", ""),
                style=payload.get("style", ""),
                seed=1000 + idx,
                out_path=str(out_path),
            )
            proc = await asyncio.to_thread(subprocess.run, cmd, shell=True, capture_output=True, text=True)
            if proc.returncode != 0 or not out_path.exists():
                continue
        else:
            _write_fallback_wav(out_path, freq=246.94 + idx * 46.72, duration_sec=6.0)
        candidates.append({"id": f"{job_id}-{idx}", "result": {"audio_url": f"/api/audio/{out_name}"}})

    if candidates:
        job["status"] = "completed"
        job["stage"] = "done"
        job["candidates"] = candidates
    else:
        job["status"] = "failed"
        job["error"] = {"code": "local_infer_failed", "message": "Local inference failed."}


@app.get("/api/quota")
async def get_quota() -> JSONResponse:
    return JSONResponse({"remaining": UNLIMITED_QUOTA})


@app.post("/api/jobs")
async def create_job(request: Request) -> JSONResponse:
    payload = await request.json()
    job_id = f"job_{uuid.uuid4().hex[:12]}"
    base_seed = int(payload.get("seed") or 1000)
    job = {
        "id": job_id,
        "kind": "group",
        "status": "queued",
        "created_at": time.time(),
        "completed_count": 0,
        "remaining": UNLIMITED_QUOTA,
        "request": payload,
        "candidates": [
            {"id": f"{job_id}-0", "status": "queued", "stage": "queued", "seed": base_seed},
            {"id": f"{job_id}-1", "status": "queued", "stage": "queued", "seed": base_seed + 1},
        ],
    }
    JOBS[job_id] = job
    asyncio.create_task(_run_t2m_job(job_id, payload))
    return JSONResponse(job)


@app.get("/api/jobs/{job_id}")
async def get_job(job_id: str) -> JSONResponse:
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return JSONResponse(job)


@app.post("/api/cover/sources")
async def upload_cover_source(request: Request) -> JSONResponse:
    ext = (request.headers.get("x-audio-extension") or "wav").strip().lower()
    raw = await request.body()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty audio body")
    source_id = f"src_{uuid.uuid4().hex[:12]}"
    out_path = SOURCES_DIR / f"{source_id}.{ext}"
    out_path.write_bytes(raw)
    SOURCES[source_id] = out_path
    return JSONResponse({"source_id": source_id})


@app.get("/api/cover/sources/{source_id}/audio")
async def get_cover_source_audio(source_id: str) -> FileResponse:
    src_path = SOURCES.get(source_id)
    if not src_path or not src_path.exists():
        raise HTTPException(status_code=404, detail="Source not found")
    return FileResponse(src_path)


@app.post("/api/cover/recognize-lyrics")
async def recognize_lyrics(request: Request) -> JSONResponse:
    body = await request.json()
    source_id = body.get("source_id", "")
    src_path = SOURCES.get(source_id)
    if not src_path or not src_path.exists():
        raise HTTPException(status_code=404, detail="Source not found")

    if WHISPER_CMD:
        cmd = WHISPER_CMD.format(in_path=str(src_path))
        proc = await asyncio.to_thread(subprocess.run, cmd, shell=True, capture_output=True, text=True)
        lyrics = proc.stdout.strip()
        return JSONResponse({"has_vocals": bool(lyrics), "lyrics": lyrics, "remaining": UNLIMITED_QUOTA})

    return JSONResponse({
        "has_vocals": True,
        "lyrics": "[Verse]\n(Local mode: set WHISPER_CMD to auto-transcribe vocals)\n",
        "remaining": UNLIMITED_QUOTA,
    })


@app.post("/api/cover/jobs")
async def create_cover_job(request: Request) -> JSONResponse:
    payload = await request.json()
    job_id = f"cover_{uuid.uuid4().hex[:12]}"
    source_id = payload.get("source_id", "")
    src_path = SOURCES.get(source_id)
    job = {
        "id": job_id,
        "created_at": time.time(),
        "status": "queued",
        "stage": "score_pending",
        "remaining": UNLIMITED_QUOTA,
        "request": payload,
        "source": {
            "source_id": source_id,
            "audio_url": f"/api/cover/sources/{source_id}/audio" if src_path else None,
            "filename": src_path.name if src_path else "source.audio",
            "size_bytes": src_path.stat().st_size if src_path and src_path.exists() else 0,
        },
        "candidates": [],
    }
    COVER_JOBS[job_id] = job
    asyncio.create_task(_run_cover_job(job_id, payload))
    return JSONResponse(job)


@app.get("/api/cover/history")
async def get_cover_history() -> JSONResponse:
    items = sorted(COVER_JOBS.values(), key=lambda j: j.get("created_at", 0), reverse=True)
    return JSONResponse({"items": items[:20]})


@app.post("/api/analytics/events")
async def analytics_events() -> JSONResponse:
    return JSONResponse({"ok": True})


@app.get("/api/cover/jobs/{job_id}")
async def get_cover_job(job_id: str) -> JSONResponse:
    job = COVER_JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Cover job not found")
    return JSONResponse(job)


@app.get("/api/audio/{filename}")
async def get_audio(filename: str) -> FileResponse:
    safe_name = Path(filename).name
    target = OUTPUT_DIR / safe_name
    if not target.exists():
        raise HTTPException(status_code=404, detail="Audio not found")
    return FileResponse(target, media_type="audio/wav")


app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=False)
