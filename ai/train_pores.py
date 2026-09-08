"""Fine-tune YOLO-seg on the pores dataset.

Scale augmentation adds size diversity the raw labels lack. Mosaic is closed
late so pores are not permanently tiny. Train/export/infer must all use imgsz 960.
"""
from pathlib import Path
import argparse
from ultralytics import YOLO

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--data", default=str(ROOT / "datasets/skin/pores/data.yaml"))
    p.add_argument("--out", default=str(ROOT / "models/skin/pores"))
    p.add_argument("--model", default="yolo26s-seg.pt")
    p.add_argument("--epochs", type=int, default=80)
    p.add_argument("--imgsz", type=int, default=960)
    p.add_argument("--device", default=None)
    p.add_argument("--batch", type=int, default=8)
    p.add_argument("--patience", type=int, default=20)
    args = p.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    model = YOLO(args.model)
    train_kwargs = dict(
        data=args.data, epochs=args.epochs, imgsz=args.imgsz, batch=args.batch,
        project=str(out / "runs"), name="pores", pretrained=True, patience=args.patience, workers=2,
        scale=0.6, mosaic=0.8, close_mosaic=15, mixup=0.0, degrees=10.0, hsv_v=0.3, fliplr=0.5,
    )
    if args.device:
        train_kwargs["device"] = args.device
    model.train(**train_kwargs)
    print(f"Next: python ai/export_model.py --weights <path-to-best.pt> --imgsz {args.imgsz}")
    print(f"Then copy the .onnx to {out}/best.onnx")


if __name__ == "__main__":
    main()
