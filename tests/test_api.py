import io
import time

import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

from src.api.server import create_app
from src.config import Workspace
from tests.conftest import ScriptedTracker, walker


def wait_for(client, job_id, timeout=60):
    deadline = time.time() + timeout
    while time.time() < deadline:
        job = client.get(f"/api/jobs/{job_id}").json()
        if job["status"] in ("succeeded", "failed", "cancelled"):
            return job
        time.sleep(0.1)
    raise AssertionError("job did not finish")


def make_video(path, frames=30, w=320, h=240, fps=15):
    writer = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"mp4v"), fps, (w, h))
    for i in range(frames):
        writer.write(np.full((h, w, 3), 40 + i * 3, dtype=np.uint8))
    writer.release()


@pytest.fixture
def client(tmp_path):
    # The default line for a 320x240 clip is at y = 132; this walker crosses it downwards at frame 10.
    def factory(config):
        return ScriptedTracker(walker(3, 160, lambda f: 60 + 8 * f, range(0, 25)))

    app = create_app(Workspace(tmp_path), tracker_factory=factory, serve_dashboard=False,
                     allowed_hosts=("testserver", "127.0.0.1", "localhost"))
    with TestClient(app, headers={"X-Aspire-Client": "test"}) as c:
        yield c


def test_full_workflow(client, tmp_path):
    assert client.get("/api/health").json()["status"] == "ok"
    assert set(client.get("/api/config").json()["trackers"]) == {"bytetrack", "botsort"}

    src = tmp_path / "upload.mp4"
    make_video(src)
    r = client.post("/api/videos", data={"split": "dev"}, files={"file": ("my clip!.mp4", src.read_bytes(), "video/mp4")})
    assert r.status_code == 201, r.text
    name = r.json()["name"]
    assert name == "my clip.mp4" and r.json()["width"] == 320

    # The same clip cannot also go into the test split.
    r = client.post("/api/videos", data={"split": "test"}, files={"file": (name, src.read_bytes(), "video/mp4")})
    assert r.status_code == 409

    assert client.get(f"/api/videos/dev/{name}/frame").headers["content-type"] == "image/jpeg"
    lines = client.get(f"/api/videos/dev/{name}/lines").json()
    assert lines["saved"] is False and lines["lines"][0]["start"][1] == 132
    r = client.put(f"/api/videos/dev/{name}/lines", json={"lines": lines["lines"]})
    assert r.status_code == 200 and r.json()["saved"] is True
    bad = {"lines": [{**lines["lines"][0], "in_direction": [1, 0]}]}
    assert client.put(f"/api/videos/dev/{name}/lines", json=bad).status_code == 400

    job = client.post("/api/runs", json={"split": "dev", "video": name, "tracker": "botsort"}).json()
    job = wait_for(client, job["id"])
    assert job["status"] == "succeeded", job["error"]
    run_id = job["run_id"]

    assert [r["run_id"] for r in client.get("/api/runs").json()] == [run_id]
    detail = client.get(f"/api/runs/{run_id}").json()
    assert detail["manifest"]["tracking"]["tracker"] == "botsort"
    assert detail["manifest"]["counts"]["total"] == {"in": 1, "out": 0, "net": 1}
    assert "video.webm" in detail["files"] and detail["evaluation"] is None

    events = client.get(f"/api/runs/{run_id}/events").json()
    assert events[0]["Event_Type"] == "CROSS_IN" and events[0]["Frame_ID"] == 10
    assert len(client.get(f"/api/runs/{run_id}/tracks").json()["Frame_ID"]) == 25

    ranged = client.get(f"/api/runs/{run_id}/files/video.webm", headers={"Range": "bytes=0-99"})
    assert ranged.status_code == 206 and len(ranged.content) == 100
    download = client.get(f"/api/runs/{run_id}/files/events.csv?download=true")
    assert "attachment" in download.headers["content-disposition"]
    assert client.get(f"/api/runs/{run_id}/files/secret.txt").status_code == 404

    gt = "Clip_ID,Frame_ID,GT_Person_ID,Line_ID,Event_Type,Notes\nmy clip.mp4,12,1,LINE_1,CROSS_IN,\n"
    r = client.post(f"/api/runs/{run_id}/evaluation", data={"tolerance_frames": "5"},
                    files={"ground_truth": ("gt.csv", io.BytesIO(gt.encode()), "text/csv")})
    assert r.status_code == 200, r.text
    assert r.json()["overall"]["tp"] == 1
    assert client.get(f"/api/runs/{run_id}/evaluation").json()["tolerance_frames"] == 5

    r = client.post(f"/api/runs/{run_id}/evaluation",
                    files={"ground_truth": ("gt.csv", io.BytesIO(b"Frame_ID,Event_Type\n5,OCCUPY\n"), "text/csv")})
    assert r.status_code == 400

    assert client.delete(f"/api/runs/{run_id}").status_code == 204
    assert client.get(f"/api/runs/{run_id}").status_code == 404


def test_rejects_unsafe_names(client):
    assert client.get("/api/runs/bad%20id!").status_code == 400
    assert client.get("/api/videos/dev/evil.exe/frame").status_code == 400
    assert client.get("/api/videos/prod/x.mp4/frame").status_code == 404
    r = client.post("/api/videos", data={"split": "dev"}, files={"file": ("x.exe", b"MZ", "application/octet-stream")})
    assert r.status_code == 400


def test_demo_job_creates_evaluated_run(client):
    job = wait_for(client, client.post("/api/demo").json()["id"], timeout=120)
    assert job["status"] == "succeeded", job["error"]
    assert client.get("/api/runs").json()[0]["evaluation_summary"]["fp"] == 1


def test_refuses_foreign_hosts_and_cross_origin_writes(client):
    # DNS rebinding: a foreign Host header is refused even for reads.
    assert client.get("/api/runs", headers={"Host": "attacker.example"}).status_code == 403
    # Another website posting to the API is refused...
    assert client.post("/api/demo", headers={"Origin": "https://attacker.example"}).status_code == 403
    # ...while the dashboard's own origin (Vite dev server or same origin) is accepted.
    assert client.get("/api/health", headers={"Origin": "https://attacker.example"}).status_code == 200
    assert client.post("/api/runs", json={}, headers={"Origin": "http://localhost:5173"}).status_code == 422
    # A write without the client header (e.g. a form post from another local server) is refused.
    del client.headers["X-Aspire-Client"]
    assert client.post("/api/demo", headers={"Origin": "http://localhost:3000"}).status_code == 403
    assert client.post("/api/demo").status_code == 403
