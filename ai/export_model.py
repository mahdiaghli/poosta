"""Export a trained Ultralytics checkpoint to ONNX for deployment.

imgsz must match training (default 960). Exporting at 640 after a 960 train
is a silent precision drop for small lesions.

If --weights is missing, the latest models/skin/**/runs/*/weights/best.pt is used
(Ultralytics names runs conditions-2, conditions-8, ... when the folder exists).
"""
from pathlib import Path
import argparse
import shutil
from ultralytics import YOLO

ROOT = Path(__file__).resolve().parents[1]


def _latest_best_pt() -> Path | None:
    runs = ROOT / "models" / "skin"
    if not runs.exists():
        return None
    found = list(runs.glob("**/runs/*/weights/best.pt"))
    if not found:
        return None
    return max(found, key=lambda p: p.stat().st_mtime)


def resolve_weights(requested: Path) -> Path:
    if requested.exists():
        return requested
    latest = _latest_best_pt()
    if latest is None:
        raise SystemExit(
            f"Weights not found: {requested}\n"
            "No models/skin/**/runs/*/weights/best.pt either. Train first, then export the path "
            "printed at the end of training (often .../runs/conditions-8/weights/best.pt)."
        )
    print(f"Requested path does not exist:\n  {requested}")
    print(f"Using latest checkpoint:\n  {latest}")
    return latest


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--weights", default="", help="Path to best.pt (optional: latest run is used)")
    p.add_argument("--imgsz", type=int, default=960)
    p.add_argument("--dynamic", action="store_true")
    args = p.parse_args()

    if args.weights:
        weights = resolve_weights(Path(args.weights))
    else:
        latest = _latest_best_pt()
        if latest is None:
            raise SystemExit("Pass --weights path/to/best.pt (no checkpoint found under models/skin/)")
        print(f"No --weights given. Using latest checkpoint:\n  {latest}")
        weights = latest
    model = YOLO(str(weights))
    out = model.export(format="onnx", imgsz=args.imgsz, dynamic=args.dynamic, simplify=True)
    print(f"ONNX exported to: {out} (imgsz={args.imgsz})")

    out_path = Path(str(out))
    if "conditions" in str(weights).replace("\\", "/"):
        dest = ROOT / "models" / "skin" / "conditions" / "best.onnx"
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(out_path, dest)
        print(f"Copied to {dest} for the AI server")
    elif "pores" in str(weights).replace("\\", "/"):
        dest = ROOT / "models" / "skin" / "pores" / "best.onnx"
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(out_path, dest)
        print(f"Copied to {dest} for the AI server")
    elif "acne" in str(weights).replace("\\", "/"):
        dest = ROOT / "models" / "skin" / "acne" / "best.onnx"
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(out_path, dest)
        print(f"Copied to {dest} for the AI server")


if __name__ == "__main__":
    main()
