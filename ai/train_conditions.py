"""Fine-tune YOLO on the merged multi-condition dataset (see
merge_condition_datasets.py). Same pattern as train_acne.py, generalized
so --data/--out/--name work for any future merged dataset too."""



from pathlib import Path
import argparse
from ultralytics import YOLO

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--data", default=str(ROOT / "datasets/skin/conditions/data.yaml"))
    p.add_argument("--out", default=str(ROOT / "models/skin/conditions"))
    p.add_argument("--model", default="yolo26n.pt")
    p.add_argument("--epochs", type=int, default=60)
    p.add_argument("--imgsz", type=int, default=640)
    p.add_argument("--device", default=None)
    p.add_argument("--batch", type=int, default=16)
    p.add_argument("--name", default="conditions")
    args = p.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    model = YOLO(args.model)
    train_kwargs = dict(data=args.data, epochs=args.epochs, imgsz=args.imgsz, batch=args.batch,
                         project=str(out / "runs"), name=args.name, pretrained=True, patience=20, workers=2)
    if args.device:
        train_kwargs["device"] = args.device
    model.train(**train_kwargs)
    results = model.val(data=args.data, imgsz=args.imgsz, device=args.device or None)
    print(f"mAP50: {getattr(results.box, 'map50', float('nan')):.4f}")
    print("Next: python ai/export_model.py --weights <path-to-best.pt>")
    print(f"Then copy the .onnx to {out}/best.onnx")


if __name__ == "__main__":
    main()
