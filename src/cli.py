"""
ASPIRE-Vision command line.

    python -m src.cli run --video data/videos/dev/clip.mp4 [--tracker botsort] [--lines lines.json]
    python -m src.cli simulate
    python -m src.cli evaluate --run <run_id> --gt data/annotations/clip_gt.csv [--tolerance 15]
    python -m src.cli serve [--port 8000]

Every command writes to the same run bundles the dashboard reads (outputs/runs/).
"""
import argparse
import json
from pathlib import Path
import sys

from src.config import SUPPORTED_TRACKERS, VIDEO_SPLITS, AppConfig, Workspace


def _print_progress(done: int, total) -> None:
    if total:
        print(f"\r  frame {done}/{total} ({done / total:.0%})", end="", flush=True)
    else:
        print(f"\r  frame {done}", end="", flush=True)


def _summarise(manifest) -> None:
    print()
    total = manifest["counts"]["total"]
    perf = manifest["performance"]
    print(f"Run {manifest['run_id']}")
    print(f"  IN {total['in']}  OUT {total['out']}  NET {total['net']:+d}")
    print(f"  tracks {manifest['tracking']['unique_tracks']}  |  {perf['processing_fps']} frames/s on {perf['device']}")


def _load_lines(args, workspace: Workspace, video: Path, split: str):
    from src.analytics.line_counter import lines_from_dicts
    from src.processing import default_lines, probe_video

    if args.lines:
        data = json.loads(Path(args.lines).read_text(encoding="utf-8"))
    else:
        saved = workspace.lines_path(split, video.name)
        if saved.is_file():
            data = json.loads(saved.read_text(encoding="utf-8"))
        else:
            meta = probe_video(video)
            data = {"lines": default_lines(meta["width"], meta["height"])}
            print(f"No counting line saved for {video.name}; using a default horizontal line. "
                  f"Draw one in the dashboard or pass --lines.")
    return lines_from_dicts(data["lines"] if isinstance(data, dict) else data)


def cmd_run(args) -> int:
    from src.processing import process_video

    workspace = Workspace.default()
    video = Path(args.video)
    split = args.split or (video.parent.name if video.parent.name in VIDEO_SPLITS else "dev")
    config = AppConfig.load(args.config).with_overrides(
        tracker={"tracker_type": args.tracker} if args.tracker else None,
        output={"write_annotated_video": True} if args.annotated else None,
    )
    lines = _load_lines(args, workspace, video, split)
    print(f"Processing {video.name} ({split}) with {config.tracker.tracker_type} ...")
    manifest = process_video(video, split, lines, config, workspace.runs_dir, progress=_print_progress)
    _summarise(manifest)
    return 0


def cmd_simulate(args) -> int:
    from src.simulate import simulate

    workspace = Workspace.default()
    print("Rendering and processing the synthetic demo scene ...")
    manifest = simulate(workspace.runs_dir, workspace.annotations_dir, AppConfig.load(args.config),
                        progress=_print_progress, evaluate=not args.no_evaluate)
    _summarise(manifest)
    if not args.no_evaluate:
        _print_evaluation(json.loads((workspace.runs_dir / manifest["run_id"] / "evaluation.json").read_text()))
    return 0


def _print_evaluation(result) -> None:
    o = result["overall"]
    print(f"Evaluation vs {result['ground_truth_file']} (tolerance +/-{result['tolerance_frames']} frames)")
    print(f"  TP {o['tp']}  FP {o['fp']}  FN {o['fn']}  precision {o['precision']}  recall {o['recall']}  F1 {o['f1']}")
    for direction, d in result["by_direction"].items():
        print(f"  {direction:<9} true {d['gt_count']}  predicted {d['pred_count']}  count error {d['count_error']:+d}")
    for w in result.get("warnings", []):
        print(f"  warning: {w}")


def cmd_evaluate(args) -> int:
    from src.evaluation.evaluate import evaluate_run

    run = Path(args.run)
    run_dir = run if run.is_dir() else Workspace.default().runs_dir / args.run
    if not run_dir.is_dir():
        print(f"Run not found: {args.run}", file=sys.stderr)
        return 1
    _print_evaluation(evaluate_run(run_dir, Path(args.gt), args.tolerance))
    return 0


def cmd_serve(args) -> int:
    import uvicorn

    from src.api.server import create_app

    uvicorn.run(create_app(), host=args.host, port=args.port, log_level="info")
    return 0


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(prog="python -m src.cli", description="ASPIRE-Vision pedestrian counting")
    parser.add_argument("--config", type=Path, default=None, help="YAML config (default configs/default_config.yaml)")
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("run", help="process a recorded video into a run bundle")
    p.add_argument("--video", required=True)
    p.add_argument("--split", choices=VIDEO_SPLITS, help="defaults to the video's folder name (dev/test)")
    p.add_argument("--tracker", choices=SUPPORTED_TRACKERS)
    p.add_argument("--lines", help="JSON file with counting lines (default: saved lines for this video)")
    p.add_argument("--annotated", action="store_true", help="also write annotated.webm with burned-in overlays")
    p.set_defaults(func=cmd_run)

    p = sub.add_parser("simulate", help="create the synthetic demo run (no model or footage needed)")
    p.add_argument("--no-evaluate", action="store_true")
    p.set_defaults(func=cmd_simulate)

    p = sub.add_parser("evaluate", help="compare a run's events with a ground-truth CSV")
    p.add_argument("--run", required=True, help="run id or run folder")
    p.add_argument("--gt", required=True, help="ground-truth CSV (docs/annotation_rules.md)")
    p.add_argument("--tolerance", type=int, default=15, help="max frame difference for a match")
    p.set_defaults(func=cmd_evaluate)

    p = sub.add_parser("serve", help="start the local API (and the built dashboard, if present)")
    p.add_argument("--host", default="127.0.0.1")
    p.add_argument("--port", type=int, default=8000)
    p.set_defaults(func=cmd_serve)

    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
