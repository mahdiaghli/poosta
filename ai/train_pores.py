"""Fine-tune YOLO-seg on the pores dataset (dermascan-ai, single class,
instance segmentation). Unzip the Roboflow export into datasets/skin/pores/
(must contain data.yaml + train/valid folders in YOLO-seg format) then run
this script."""
from pathlib import Path
import argparse
from ultralytics import YOLO

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--data", default=str(ROOT / "datasets/skin/pores/data.yaml"))
    p.add_argument("--out", default=str(ROOT / "models/skin/pores"))
    p.add_argument("--model", default="yolo26n-seg.pt")  # segmentation variant
    p.add_argument("--epochs", type=int, default=60)
    p.add_argument("--imgsz", type=int, default=640)
    p.add_argument("--device", default=None)
    p.add_argument("--batch", type=int, default=16)
    args = p.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    model = YOLO(args.model)
    train_kwargs = dict(data=args.data, epochs=args.epochs, imgsz=args.imgsz, batch=args.batch,
                         project=str(out / "runs"), name="pores", pretrained=True, patience=20, workers=2)
    if args.device:
        train_kwargs["device"] = args.device
    model.train(**train_kwargs)
    print("Next: python ai/export_model.py --weights <path-to-best.pt>")
    print(f"Then copy the .onnx to {out}/best.onnx")


if __name__ == "__main__":
    main()
