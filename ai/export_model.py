"""Export a trained Ultralytics checkpoint to ONNX for deployment."""
from pathlib import Path
import argparse
from ultralytics import YOLO

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUT = ROOT / "models/skin/acne"


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--weights", required=True, help="Path to best.pt")
    p.add_argument("--imgsz", type=int, default=640)
    p.add_argument("--dynamic", action="store_true")
    args = p.parse_args()

    DEFAULT_OUT.mkdir(parents=True, exist_ok=True)
    model = YOLO(args.weights)
    out = model.export(format="onnx", imgsz=args.imgsz, dynamic=args.dynamic, simplify=True)
    print(f"ONNX exported to: {out}")


if __name__ == "__main__":
    main()
