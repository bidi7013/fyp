"""
In-memory job queue for the local API.

Processing is CPU/GPU heavy, so jobs run one at a time on a single worker thread.
The dashboard polls job status; finished runs are persisted as run bundles, so
nothing is lost if the server restarts (only the job history is).
"""
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict, dataclass, field
from datetime import datetime
import threading
import traceback
from typing import Any, Callable, Dict, List, Optional
import uuid

from src.processing import RunCancelled

JobFn = Callable[[Callable[[int, Optional[int]], None], Callable[[], bool]], Dict[str, Any]]


def _now() -> str:
    return datetime.now().isoformat(timespec="seconds")


@dataclass
class Job:
    id: str
    kind: str  # 'process' or 'demo'
    label: str
    params: Dict[str, Any]
    status: str = "queued"  # queued | running | succeeded | failed | cancelled
    created_at: str = field(default_factory=_now)
    started_at: Optional[str] = None
    finished_at: Optional[str] = None
    frames_done: int = 0
    frames_total: Optional[int] = None
    run_id: Optional[str] = None
    error: Optional[str] = None
    cancel_requested: bool = False

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["progress"] = (
            min(1.0, self.frames_done / self.frames_total) if self.frames_total else None
        )
        return data


class JobManager:
    def __init__(self, max_history: int = 100):
        self._executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="aspire-job")
        self._jobs: Dict[str, Job] = {}
        self._lock = threading.Lock()
        self._max_history = max_history

    def submit(self, kind: str, label: str, params: Dict[str, Any], fn: JobFn) -> Job:
        job = Job(id=uuid.uuid4().hex[:12], kind=kind, label=label, params=params)
        with self._lock:
            self._jobs[job.id] = job
            self._trim()
        self._executor.submit(self._run, job, fn)
        return job

    def _trim(self) -> None:
        finished = [j for j in self._jobs.values() if j.status in ("succeeded", "failed", "cancelled")]
        for job in finished[: max(0, len(self._jobs) - self._max_history)]:
            del self._jobs[job.id]

    def _run(self, job: Job, fn: JobFn) -> None:
        with self._lock:
            if job.cancel_requested:
                job.status, job.finished_at = "cancelled", _now()
                return
            job.status, job.started_at = "running", _now()

        def progress(done: int, total: Optional[int]) -> None:
            with self._lock:
                job.frames_done, job.frames_total = done, total

        try:
            manifest = fn(progress, lambda: job.cancel_requested)
            with self._lock:
                job.status, job.run_id = "succeeded", manifest["run_id"]
        except RunCancelled:
            with self._lock:
                job.status = "cancelled"
        except Exception as exc:  # reported to the dashboard, not raised
            traceback.print_exc()
            with self._lock:
                job.status, job.error = "failed", f"{type(exc).__name__}: {exc}"
        finally:
            with self._lock:
                job.finished_at = _now()

    def get(self, job_id: str) -> Optional[Job]:
        with self._lock:
            return self._jobs.get(job_id)

    def list(self) -> List[Dict[str, Any]]:
        with self._lock:
            return [job.to_dict() for job in reversed(list(self._jobs.values()))]

    def cancel(self, job_id: str) -> Optional[Job]:
        with self._lock:
            job = self._jobs.get(job_id)
            if job is not None and job.status in ("queued", "running"):
                job.cancel_requested = True
            return job

    def shutdown(self) -> None:
        with self._lock:
            for job in self._jobs.values():
                job.cancel_requested = True
        self._executor.shutdown(wait=True)
