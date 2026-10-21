"""
Local HTTP API used by the dashboard.

Start with `python -m src.cli serve` (binds to 127.0.0.1 only). The API manages
videos (dev/test splits), per-video counting lines, processing jobs, run bundles
and evaluations. It calls exactly the same functions as the CLI.
"""
from contextlib import asynccontextmanager
import json
from pathlib import Path
import re
import shutil
from typing import Any, Callable, Dict, List, Literal, Optional, Tuple

import cv2
from urllib.parse import urlsplit

from fastapi import FastAPI, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
import yaml

from src import __version__
from src.analytics.line_counter import lines_from_dicts
from src.api.jobs import JobManager
from src.config import PROJECT_ROOT, SUPPORTED_TRACKERS, VIDEO_EXTENSIONS, VIDEO_SPLITS, AppConfig, TrackerConfig, Workspace
from src.evaluation.evaluate import DEFAULT_TOLERANCE_FRAMES, evaluate_run
from src.export.run_bundle import (
    BUNDLE_FILES, EVALUATION, RUN_ID_PATTERN, bundle_files, list_runs, read_events, read_manifest,
    read_tracks_columnar,
)
from src.processing import default_lines, probe_video, process_video, read_frame
from src.tracking.tracker import BaseTracker

MAX_UPLOAD_BYTES = 2 * 1024 ** 3
_VIDEO_NAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._ -]{0,150}$")
_MEDIA_TYPES = {".webm": "video/webm", ".csv": "text/csv", ".json": "application/json"}
DASHBOARD_DIST = PROJECT_ROOT / "dashboard" / "dist"

# The API has no authentication, so it must only be reachable from this machine.
# Host checks stop DNS-rebinding pages from reading it; Origin checks stop other
# websites open in the browser from sending it state-changing requests. Writes
# must also carry CLIENT_HEADER: a cross-origin page cannot add a custom header
# without a CORS preflight, which this API never grants, so this holds even for
# other servers running on localhost.
LOOPBACK_HOSTS = ("127.0.0.1", "localhost", "::1")
SAFE_METHODS = ("GET", "HEAD", "OPTIONS")
CLIENT_HEADER = "X-Aspire-Client"

TrackerFactory = Callable[[AppConfig], BaseTracker]


class LineModel(BaseModel):
    id: str
    name: str = ""
    start: Tuple[float, float]
    end: Tuple[float, float]
    in_direction: Tuple[float, float]


class LinesBody(BaseModel):
    lines: List[LineModel] = Field(min_length=1, max_length=8)


class RunRequest(BaseModel):
    split: Literal["dev", "test"]
    video: str
    tracker: Literal["bytetrack", "botsort"] = "bytetrack"
    confidence_threshold: Optional[float] = Field(None, ge=0.01, le=0.95)
    hysteresis_buffer_pixels: Optional[float] = Field(None, ge=0, le=200)
    min_frames_between_events: Optional[int] = Field(None, ge=0, le=10000)
    write_annotated_video: bool = False


def _clean_upload_name(filename: str) -> str:
    name = Path(filename or "").name
    stem, ext = Path(name).stem, Path(name).suffix.lower()
    stem = re.sub(r"[^A-Za-z0-9._ -]+", "_", stem).strip(" ._") or "video"
    if ext not in VIDEO_EXTENSIONS:
        raise HTTPException(400, f"Unsupported video type '{ext}'. Use one of {', '.join(VIDEO_EXTENSIONS)}")
    return f"{stem[:120]}{ext}"


def create_app(
    workspace: Optional[Workspace] = None,
    config_path: Optional[Path] = None,
    tracker_factory: Optional[TrackerFactory] = None,
    serve_dashboard: bool = True,
    allowed_hosts: Tuple[str, ...] = LOOPBACK_HOSTS,
) -> FastAPI:
    workspace = workspace or Workspace.default()
    workspace.ensure()
    jobs = JobManager()
    probe_cache: Dict[Tuple[str, float], Dict[str, Any]] = {}

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        yield
        jobs.shutdown()

    app = FastAPI(title="ASPIRE-Vision API", version=__version__, lifespan=lifespan)
    app.state.jobs = jobs
    app.state.workspace = workspace

    @app.middleware("http")
    async def local_only(request: Request, call_next):
        host = urlsplit(f"//{request.headers.get('host', '')}").hostname
        if host not in allowed_hosts:
            return JSONResponse({"detail": "Host not allowed"}, status_code=403)
        if request.method not in SAFE_METHODS:
            origin = request.headers.get("origin")
            if origin is not None and urlsplit(origin).hostname not in allowed_hosts:
                return JSONResponse({"detail": "Cross-origin request refused"}, status_code=403)
            if CLIENT_HEADER.lower() not in request.headers:
                return JSONResponse({"detail": f"Missing {CLIENT_HEADER} header"}, status_code=403)
        return await call_next(request)

    def base_config() -> AppConfig:
        return AppConfig.load(config_path)

    def video_file(split: str, name: str) -> Path:
        if split not in VIDEO_SPLITS:
            raise HTTPException(404, "Unknown split")
        if not _VIDEO_NAME.match(name) or Path(name).name != name or Path(name).suffix.lower() not in VIDEO_EXTENSIONS:
            raise HTTPException(400, "Invalid video name")
        path = workspace.video_path(split, name)
        if not path.is_file():
            raise HTTPException(404, f"Video '{name}' not found in {split}")
        return path

    def run_dir(run_id: str) -> Path:
        if not RUN_ID_PATTERN.match(run_id):
            raise HTTPException(400, "Invalid run id")
        path = workspace.runs_dir / run_id
        if not (path / "manifest.json").is_file():
            raise HTTPException(404, f"Run '{run_id}' not found")
        return path

    def video_entry(split: str, path: Path) -> Dict[str, Any]:
        key = (str(path), path.stat().st_mtime)
        if key not in probe_cache:
            try:
                probe_cache[key] = probe_video(path)
            except ValueError as exc:
                probe_cache[key] = {"error": str(exc)}
        return {
            "name": path.name,
            "split": split,
            "size_bytes": path.stat().st_size,
            "has_lines": workspace.lines_path(split, path.name).is_file(),
            **probe_cache[key],
        }

    # ---- status & config -------------------------------------------------
    @app.get("/api/health")
    def health():
        weights = base_config().detector.model_weights
        return {
            "status": "ok",
            "version": __version__,
            "model_weights": weights,
            "weights_present": (PROJECT_ROOT / weights).is_file() or Path(weights).is_file(),
        }

    @app.get("/api/config")
    def config():
        trackers = {}
        for name in SUPPORTED_TRACKERS:
            with open(TrackerConfig(name).config_path(), "r", encoding="utf-8") as f:
                trackers[name] = yaml.safe_load(f)
        return {"defaults": base_config().to_dict(), "trackers": trackers, "splits": list(VIDEO_SPLITS)}

    # ---- videos & counting lines ----------------------------------------
    @app.get("/api/videos")
    def list_videos():
        items = []
        for split in VIDEO_SPLITS:
            folder = workspace.videos_dir / split
            for path in sorted(folder.iterdir()) if folder.is_dir() else []:
                if path.is_file() and path.suffix.lower() in VIDEO_EXTENSIONS:
                    items.append(video_entry(split, path))
        return items

    @app.post("/api/videos", status_code=201)
    def upload_video(file: UploadFile = File(...), split: Literal["dev", "test"] = Form(...)):
        name = _clean_upload_name(file.filename or "")
        target = workspace.video_path(split, name)
        if target.exists():
            raise HTTPException(409, f"'{name}' already exists in {split}")
        other = "test" if split == "dev" else "dev"
        if workspace.video_path(other, name).exists():
            raise HTTPException(409, f"'{name}' is already in the {other} split; a clip must stay in one split")
        written = 0
        try:
            with open(target, "wb") as out:
                while chunk := file.file.read(1024 * 1024):
                    written += len(chunk)
                    if written > MAX_UPLOAD_BYTES:
                        raise HTTPException(413, "Video is larger than 2 GB")
                    out.write(chunk)
            entry = video_entry(split, target)
            if "error" in entry:
                raise HTTPException(400, entry["error"])
        except BaseException:
            target.unlink(missing_ok=True)
            raise
        return entry

    @app.get("/api/videos/{split}/{name}/frame")
    def video_frame(split: str, name: str, index: int = Query(0, ge=0)):
        try:
            frame = read_frame(video_file(split, name), index)
        except ValueError as exc:
            raise HTTPException(400, str(exc))
        ok, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 88])
        if not ok:
            raise HTTPException(500, "Could not encode frame")
        return Response(buf.tobytes(), media_type="image/jpeg", headers={"Cache-Control": "no-store"})

    @app.get("/api/videos/{split}/{name}/lines")
    def get_lines(split: str, name: str):
        path = video_file(split, name)
        saved = workspace.lines_path(split, name)
        if saved.is_file():
            data = json.loads(saved.read_text(encoding="utf-8"))
            return {"saved": True, "lines": data["lines"]}
        meta = video_entry(split, path)
        return {"saved": False, "lines": default_lines(meta.get("width") or 1280, meta.get("height") or 720)}

    @app.put("/api/videos/{split}/{name}/lines")
    def put_lines(split: str, name: str, body: LinesBody):
        video_file(split, name)
        raw = [line.model_dump() for line in body.lines]
        try:
            lines = lines_from_dicts(raw)
        except ValueError as exc:
            raise HTTPException(400, str(exc))
        data = {"video": name, "split": split, "lines": [line.to_dict() for line in lines]}
        workspace.lines_dir.mkdir(parents=True, exist_ok=True)
        workspace.lines_path(split, name).write_text(json.dumps(data, indent=2), encoding="utf-8")
        return {"saved": True, "lines": data["lines"]}

    # ---- jobs ------------------------------------------------------------
    @app.post("/api/runs", status_code=202)
    def start_run(body: RunRequest):
        video = video_file(body.split, body.video)
        lines_data = get_lines(body.split, body.video)["lines"]
        try:
            lines = lines_from_dicts(lines_data)
        except ValueError as exc:
            raise HTTPException(400, str(exc))
        counting = {k: v for k, v in {
            "hysteresis_buffer_pixels": body.hysteresis_buffer_pixels,
            "min_frames_between_events": body.min_frames_between_events,
        }.items() if v is not None}
        config = base_config().with_overrides(
            tracker={"tracker_type": body.tracker},
            detector={"confidence_threshold": body.confidence_threshold} if body.confidence_threshold is not None else None,
            counting=counting,
            output={"write_annotated_video": body.write_annotated_video},
        )

        def work(progress, should_cancel):
            tracker = tracker_factory(config) if tracker_factory else None
            return process_video(video, body.split, lines, config, workspace.runs_dir, tracker=tracker,
                                 progress=progress, should_cancel=should_cancel)

        job = jobs.submit("process", f"{body.video} · {body.tracker}", body.model_dump(), work)
        return job.to_dict()

    @app.post("/api/demo", status_code=202)
    def start_demo():
        from src.simulate import simulate

        def work(progress, should_cancel):
            return simulate(workspace.runs_dir, workspace.annotations_dir, base_config(),
                            progress=progress, should_cancel=should_cancel)

        return jobs.submit("demo", "Synthetic demo scene", {}, work).to_dict()

    @app.get("/api/jobs")
    def list_jobs():
        return jobs.list()

    @app.get("/api/jobs/{job_id}")
    def get_job(job_id: str):
        job = jobs.get(job_id)
        if job is None:
            raise HTTPException(404, "Job not found")
        return job.to_dict()

    @app.post("/api/jobs/{job_id}/cancel")
    def cancel_job(job_id: str):
        job = jobs.cancel(job_id)
        if job is None:
            raise HTTPException(404, "Job not found")
        return job.to_dict()

    # ---- runs ------------------------------------------------------------
    @app.get("/api/runs")
    def runs():
        return list_runs(workspace.runs_dir)

    @app.get("/api/runs/{run_id}")
    def get_run(run_id: str):
        path = run_dir(run_id)
        evaluation = None
        if (path / EVALUATION).is_file():
            evaluation = json.loads((path / EVALUATION).read_text(encoding="utf-8"))
        return {"manifest": read_manifest(path), "files": bundle_files(path), "evaluation": evaluation}

    @app.delete("/api/runs/{run_id}", status_code=204)
    def delete_run(run_id: str):
        shutil.rmtree(run_dir(run_id))
        return Response(status_code=204)

    @app.get("/api/runs/{run_id}/events")
    def run_events(run_id: str):
        return read_events(run_dir(run_id))

    @app.get("/api/runs/{run_id}/tracks")
    def run_tracks(run_id: str):
        return read_tracks_columnar(run_dir(run_id))

    @app.get("/api/runs/{run_id}/files/{name}")
    def run_file(run_id: str, name: str, download: bool = False):
        if name not in BUNDLE_FILES:
            raise HTTPException(404, "Unknown file")
        path = run_dir(run_id) / name
        if not path.is_file():
            raise HTTPException(404, f"{name} was not produced for this run")
        media_type = _MEDIA_TYPES.get(path.suffix, "application/octet-stream")
        if download:
            return FileResponse(path, media_type=media_type, filename=f"{run_id}_{name}")
        return FileResponse(path, media_type=media_type)

    @app.get("/api/runs/{run_id}/evaluation")
    def get_evaluation(run_id: str):
        path = run_dir(run_id) / EVALUATION
        if not path.is_file():
            raise HTTPException(404, "This run has not been evaluated yet")
        return json.loads(path.read_text(encoding="utf-8"))

    @app.post("/api/runs/{run_id}/evaluation")
    def post_evaluation(
        run_id: str,
        ground_truth: UploadFile = File(...),
        tolerance_frames: int = Form(DEFAULT_TOLERANCE_FRAMES, ge=0, le=300),
    ):
        path = run_dir(run_id)
        upload = path / "ground_truth.upload.csv"
        try:
            with open(upload, "wb") as out:
                shutil.copyfileobj(ground_truth.file, out)
            return evaluate_run(path, upload, tolerance_frames)
        except (ValueError, KeyError, UnicodeDecodeError) as exc:
            raise HTTPException(400, f"Could not evaluate: {exc}")
        finally:
            upload.unlink(missing_ok=True)

    if serve_dashboard and DASHBOARD_DIST.is_dir():
        app.mount("/", StaticFiles(directory=DASHBOARD_DIST, html=True), name="dashboard")

    return app
