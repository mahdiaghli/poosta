"""Fine-tune a pretrained Ultralytics YOLO model for acne/skin-lesion detection.
Dataset format: YOLO detection format, see datasets/skin/acne/README.md.
"""
from pathlib import Path
import argparse
from ultralytics import YOLO

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATA = ROOT / "datasets/skin/acne/data.yaml"
DEFAULT_OUT = ROOT / "models/skin/acne"


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--data", default=str(DEFAULT_DATA))
    p.add_argument("--model", default="yolo26s.pt")
    p.add_argument("--epochs", type=int, default=50)
    p.add_argument("--imgsz", type=int, default=960)
    p.add_argument("--device", default=None, help="cpu, 0, 0,1, etc.")
    p.add_argument("--batch", type=int, default=8)
    p.add_argument("--name", default="acne")
    args = p.parse_args()

    DEFAULT_OUT.mkdir(parents=True, exist_ok=True)
    model = YOLO(args.model)
    train_kwargs = dict(
        data=args.data,
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        project=str(DEFAULT_OUT / "runs"),
        name=args.name,
        pretrained=True,
        patience=20,
        workers=2,
        mosaic=0.8,
        close_mosaic=15,
        mixup=0.0,
        copy_paste=0.2,
        scale=0.3,
        fliplr=0.5,
    )
    if args.device:
        train_kwargs["device"] = args.device

    model.train(**train_kwargs)
    results = model.val(data=args.data, imgsz=args.imgsz, device=args.device or None)
    print(f"mAP50: {getattr(results.box, 'map50', float('nan')):.4f}")
    print(f"mAP50-95: {getattr(results.box, 'map', float('nan')):.4f}")
    print(f"Next: python ai/export_model.py --weights <path-to-best.pt> --imgsz {args.imgsz}")


if __name__ == "__main__":
    main()
