"""Fine-tune YOLO on the lesion-only merged dataset (merge_condition_datasets.py).

Defaults match deployment: imgsz 960, no mixup (label noise on overlapping
skin classes), mosaic closed in the last epochs so tiny whiteheads/blackheads
are not permanently downscaled, copy-paste for rare small lesions instead of
byte-duplicating train images.
"""
from pathlib import Path
import argparse
import yaml
from ultralytics import YOLO

ROOT = Path(__file__).resolve().parents[1]


def _absolute_dataset_yaml(data_path: Path) -> Path:
    """Ultralytics treats yaml `path` as cwd-relative. Rewrite it to the folder
    that actually contains images/ so train works from any working directory."""
    data_path = data_path.resolve()
    cfg = yaml.safe_load(data_path.read_text(encoding="utf-8"))
    root = Path(str(cfg.get("path") or data_path.parent))
    if not root.is_absolute():
        root = (data_path.parent / root).resolve()
    train_rel = cfg.get("train") or "images/train"
    train_dir = root / train_rel if not Path(train_rel).is_absolute() else Path(train_rel)
    if not train_dir.exists():
        root = data_path.parent
    cfg["path"] = root.resolve().as_posix()
    data_path.write_text(yaml.safe_dump(cfg, allow_unicode=True, sort_keys=False), encoding="utf-8")
    return data_path


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--data", default=str(ROOT / "datasets/skin/conditions/data.yaml"))
    p.add_argument("--out", default=str(ROOT / "models/skin/conditions"))
    p.add_argument("--model", default="yolo26s.pt", help="Prefer s/m over n; nano underfit this task")
    p.add_argument("--epochs", type=int, default=80)
    p.add_argument("--imgsz", type=int, default=960)
    p.add_argument("--device", default=None)
    p.add_argument("--batch", type=int, default=8)
    p.add_argument("--patience", type=int, default=20)
    p.add_argument("--name", default="conditions")
    args = p.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    data_yaml = _absolute_dataset_yaml(Path(args.data))
    model = YOLO(args.model)
    train_kwargs = dict(
        data=str(data_yaml), epochs=args.epochs, imgsz=args.imgsz, batch=args.batch,
        project=str(out / "runs"), name=args.name, pretrained=True, patience=args.patience, workers=2,
        mosaic=0.5, close_mosaic=15, mixup=0.0, copy_paste=0.0,
        degrees=8.0, scale=0.3, shear=0.0, fliplr=0.5,
        hsv_h=0.01, hsv_s=0.4, hsv_v=0.3,
        cls=2.0,
    )
    if args.device:
        train_kwargs["device"] = args.device
    model.train(**train_kwargs)
    results = model.val(data=str(data_yaml), imgsz=args.imgsz, device=args.device or None)
    print(f"mAP50: {getattr(results.box, 'map50', float('nan')):.4f}")
    print(f"mAP50-95: {getattr(results.box, 'map', float('nan')):.4f}")
    print(f"Next: python ai/export_model.py --weights <path-to-best.pt> --imgsz {args.imgsz}")
    print(f"Then copy the .onnx to {out}/best.onnx")


if __name__ == "__main__":
    main()
