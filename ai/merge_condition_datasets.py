"""Merge Roboflow YOLO-detection exports into a lesion-only detection dataset.

Region-level attributes (oily / dry / redness / enlarged-pores / wrinkles) are
dropped from the detector: they are not instance objects and were the main
source of background FPs vs tiny lesions. Those metrics stay on classical CV
(or a separate classifier).

Also:
  - merge typo class names (Englarget-Pores, etc.) before unifying ids
  - collapse overlapping same-class boxes (IoU >= 0.7, keep larger)
  - do NOT byte-duplicate rare images (that overfits and does not help val)
  - rewrite OUT_DIR from scratch so re-runs do not accumulate old files
  - data.yaml path is '.' (next to this yaml) so Ultralytics does not nest paths
"""
from __future__ import annotations

import shutil
from collections import Counter, defaultdict
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "datasets/skin/conditions_raw"
OUT_DIR = ROOT / "datasets/skin/conditions"

# Roboflow / plot typos -> canonical key (after normalize)
CLASS_ALIASES: dict[str, str] = {
    "englarget-pores": "enlarged-pores",
    "englared-pores": "enlarged-pores",
    "englarged-pores": "enlarged-pores",
    "enlargedpore": "enlarged-pores",
    "enlarged-pore": "enlarged-pores",
    "darkspot": "dark-spots",
    "dark-spot": "dark-spots",
    "darkspots": "dark-spots",
    "pimple": "acne",
    "pimples": "acne",
    "blackhead": "blackheads",
    "whitehead": "whiteheads",
    "wrinkle": "wrinkles",
    "eyebag": "eyebags",
    "eye-bags": "eyebags",
    "oily": "oily-skin",
    "dry": "dry-skin",
    "redness": "skin-redness",
    "erythema": "skin-redness",
}

# Instance-like boxes the detector should learn. Eyebags stay: they are localized
# and were the only class with usable AP on the previous runs.
DETECTION_KEYS = frozenset({"acne", "blackheads", "whiteheads", "dark-spots", "eyebags"})
REGION_KEYS = frozenset({"oily-skin", "dry-skin", "enlarged-pores", "skin-redness", "wrinkles"})

CANONICAL_DISPLAY = {
    "acne": "Acne",
    "blackheads": "Blackheads",
    "whiteheads": "Whiteheads",
    "dark-spots": "Dark-Spots",
    "eyebags": "Eyebags",
}

REGION_DISPLAY = {
    "oily-skin": "Oily-Skin",
    "dry-skin": "Dry-Skin",
    "enlarged-pores": "Enlarged-Pores",
    "skin-redness": "Skin-Redness",
    "wrinkles": "Wrinkles",
}

REGION_OUT = ROOT / "datasets/skin/severity/region_attributes"

CANONICAL_DISPLAY = {
    "acne": "Acne",
    "blackheads": "Blackheads",
    "whiteheads": "Whiteheads",
    "dark-spots": "Dark-Spots",
    "eyebags": "Eyebags",
}

# Skip composites / non-photo / unlabeled-condition dumps that teach the
# detector to fire on bottles, cracked-earth overlays, or whole-cheek redness.
SKIP_NAME_FRAGMENTS = (
    "kering", "milk", "bottle", "cracked", "roseca", "rosacea",
    "berminyak", "overlay",
)

NMS_IOU = 0.7


def normalize(name: str) -> str:
    key = name.strip().lower().replace("_", "-").replace(" ", "-")
    while "--" in key:
        key = key.replace("--", "-")
    return CLASS_ALIASES.get(key, key)


def _xywhn_to_xyxy(xc: float, yc: float, w: float, h: float) -> tuple[float, float, float, float]:
    return xc - w / 2, yc - h / 2, xc + w / 2, yc + h / 2


def _area(box: tuple[float, float, float, float]) -> float:
    x1, y1, x2, y2 = box
    return max(0.0, x2 - x1) * max(0.0, y2 - y1)


def _iou(a: tuple[float, float, float, float], b: tuple[float, float, float, float]) -> float:
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    inter = max(0.0, ix2 - ix1) * max(0.0, iy2 - iy1)
    union = _area(a) + _area(b) - inter
    return inter / union if union > 0 else 0.0


def nms_same_class(rows: list[list[str]], iou_thr: float = NMS_IOU) -> list[list[str]]:
    """Keep the largest box when same-class YOLO rows overlap."""
    by_cls: dict[str, list[list[str]]] = defaultdict(list)
    for parts in rows:
        by_cls[parts[0]].append(parts)
    kept: list[list[str]] = []
    for _cls, group in by_cls.items():
        parsed: list[tuple[float, list[str], tuple[float, float, float, float]]] = []
        for parts in group:
            try:
                xc, yc, w, h = map(float, parts[1:5])
            except (ValueError, IndexError):
                kept.append(parts)
                continue
            box = _xywhn_to_xyxy(xc, yc, w, h)
            parsed.append((_area(box), parts, box))
        parsed.sort(key=lambda t: t[0], reverse=True)
        selected: list[tuple[list[str], tuple[float, float, float, float]]] = []
        for _area_i, parts, box in parsed:
            if any(_iou(box, other) >= iou_thr for _, other in selected):
                continue
            selected.append((parts, box))
        kept.extend(p for p, _ in selected)
    return kept


def drop_region_sized_boxes(rows: list[list[str]], names: list[str], max_area: float = 0.12) -> list[list[str]]:
    """Drop YOLO boxes that cover most of the image — those are redness/oily
    regions, not lesions, and they train the model to call background 'acne'."""
    kept: list[list[str]] = []
    for parts in rows:
        try:
            cid = int(parts[0])
            _xc, _yc, w, h = map(float, parts[1:5])
        except (ValueError, IndexError):
            continue
        name = names[cid].lower() if 0 <= cid < len(names) else ""
        if "eyebag" not in name and (w * h) > max_area:
            continue
        kept.append(parts)
    return kept


def _load_names(data_yaml: Path) -> list[str]:
    names = yaml.safe_load(data_yaml.read_text(encoding="utf-8"))["names"]
    if isinstance(names, list):
        return names
    return [names[i] for i in sorted(names)]


def write_region_dataset() -> None:
    """Image-level 0/1 labels for oily/dry/pores/redness/wrinkles (not YOLO boxes)."""
    import csv

    dataset_dirs = [d for d in RAW_DIR.iterdir() if d.is_dir() and (d / "data.yaml").exists()]
    if not dataset_dirs:
        raise SystemExit(f"No datasets found in {RAW_DIR}.")

    col_keys = list(REGION_DISPLAY.keys())
    col_names = [REGION_DISPLAY[k] for k in col_keys]
    if REGION_OUT.exists():
        shutil.rmtree(REGION_OUT)
    REGION_OUT.mkdir(parents=True)

    rows: list[dict[str, str]] = []
    positives = Counter()
    skipped = 0
    for d in dataset_dirs:
        names = _load_names(d / "data.yaml")
        local_to_region: dict[int, str] = {}
        for i, name in enumerate(names):
            key = normalize(name)
            if key in REGION_KEYS:
                local_to_region[i] = key
        for _split, split_in in [("train", ["train"]), ("val", ["valid", "val"])]:
            src = next((d / s for s in split_in if (d / s / "images").exists()), None)
            if src is None:
                continue
            for img in src.joinpath("images").glob("*"):
                if not img.is_file():
                    continue
                if any(frag in img.stem.lower() for frag in SKIP_NAME_FRAGMENTS):
                    skipped += 1
                    continue
                flags = {k: 0 for k in col_keys}
                label_src = src / "labels" / (img.stem + ".txt")
                if label_src.exists():
                    for line in label_src.read_text(encoding="utf-8", errors="ignore").splitlines():
                        parts = line.split()
                        if not parts:
                            continue
                        try:
                            cid = int(parts[0])
                        except ValueError:
                            continue
                        rk = local_to_region.get(cid)
                        if rk:
                            flags[rk] = 1
                dest_name = f"{d.name}__{img.name}"
                shutil.copy2(img, REGION_OUT / dest_name)
                row = {"filename": dest_name, **{REGION_DISPLAY[k]: str(flags[k]) for k in col_keys}}
                rows.append(row)
                for k, v in flags.items():
                    if v:
                        positives[k] += 1

    with (REGION_OUT / "_classes.csv").open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["filename", *col_names])
        writer.writeheader()
        writer.writerows(rows)
    print(f"\nRegion classification set at {REGION_OUT} ({len(rows)} images, skipped {skipped})")
    for k in col_keys:
        print(f"  {REGION_DISPLAY[k]} positives: {positives[k]}")
    print("Train with:")
    print("  python ai/train_severity.py --data-dir datasets/skin/severity/region_attributes --out-dir models/skin/regions --epochs 20 --device cuda")


def merge_lesions() -> None:
    dataset_dirs = [d for d in RAW_DIR.iterdir() if d.is_dir() and (d / "data.yaml").exists()]
    if not dataset_dirs:
        raise SystemExit(f"No datasets found in {RAW_DIR}. Unzip each Roboflow export into its own subfolder first.")

    unified: list[str] = []
    key_to_id: dict[str, int] = {}
    per_dataset_map: dict[Path, dict[int, int | None]] = {}

    for d in dataset_dirs:
        names = _load_names(d / "data.yaml")
        remap: dict[int, int | None] = {}
        for local_idx, name in enumerate(names):
            key = normalize(name)
            if key not in DETECTION_KEYS:
                remap[local_idx] = None
                continue
            if key not in key_to_id:
                key_to_id[key] = len(unified)
                unified.append(CANONICAL_DISPLAY.get(key, name))
            remap[local_idx] = key_to_id[key]
        per_dataset_map[d] = remap
        dropped = [n for i, n in enumerate(names) if remap[i] is None]
        print(f"{d.name}: {names}")
        if dropped:
            print(f"  dropped (not instance lesions): {dropped}")
    print(f"\nDetection classes ({len(unified)}): {unified}\n")

    if OUT_DIR.exists():
        shutil.rmtree(OUT_DIR)
    for split_out in ("train", "val"):
        (OUT_DIR / "images" / split_out).mkdir(parents=True)
        (OUT_DIR / "labels" / split_out).mkdir(parents=True)

    instance_counts: Counter[int] = Counter()
    image_counts = {"train": 0, "val": 0}
    skipped_synthetic = 0

    for d in dataset_dirs:
        remap = per_dataset_map[d]
        for split_out, split_in_candidates in [("train", ["train"]), ("val", ["valid", "val"])]:
            src = next((d / s for s in split_in_candidates if (d / s / "images").exists()), None)
            if src is None:
                continue
            for img in (src / "images").glob("*"):
                if not img.is_file():
                    continue
                stem_l = img.stem.lower()
                if any(frag in stem_l for frag in SKIP_NAME_FRAGMENTS):
                    skipped_synthetic += 1
                    continue
                label_src = src / "labels" / (img.stem + ".txt")
                lines_out: list[list[str]] = []
                if label_src.exists():
                    for line in label_src.read_text(encoding="utf-8", errors="ignore").splitlines():
                        parts = line.split()
                        if not parts:
                            continue
                        try:
                            local_cls = int(parts[0])
                        except ValueError:
                            continue
                        new_cls = remap.get(local_cls)
                        if new_cls is None:
                            continue
                        parts[0] = str(new_cls)
                        lines_out.append(parts)
                lines_out = nms_same_class(lines_out)
                lines_out = drop_region_sized_boxes(lines_out, unified)
                # Keep negatives (no lesion boxes): they teach "don't fire on oily/dry regions".
                dst_img = OUT_DIR / "images" / split_out / f"{d.name}__{img.name}"
                shutil.copy2(img, dst_img)
                dst_label = OUT_DIR / "labels" / split_out / f"{d.name}__{img.stem}.txt"
                dst_label.write_text("\n".join(" ".join(p) for p in lines_out), encoding="utf-8")
                image_counts[split_out] += 1
                for parts in lines_out:
                    instance_counts[int(parts[0])] += 1

    print("Per-class instance counts (train+val, after NMS, lesion-only):")
    for cid, name in enumerate(unified):
        print(f"  {name}: {instance_counts.get(cid, 0)}")
    print(f"Skipped synthetic/non-photo name matches: {skipped_synthetic}")

    # Ultralytics resolves `path` from cwd (or DATASETS_DIR), not from this yaml
    # file. A relative "." becomes <repo>/images/val and training fails.
    dataset_root = OUT_DIR.resolve().as_posix()
    (OUT_DIR / "data.yaml").write_text(
        yaml.safe_dump(
            {
                "path": dataset_root,
                "train": "images/train",
                "val": "images/val",
                "names": {i: n for i, n in enumerate(unified)},
            },
            allow_unicode=True,
            sort_keys=False,
        ),
        encoding="utf-8",
    )
    print(f"\nDone. Lesion detection dataset at {OUT_DIR}")
    print(" train:", image_counts["train"])
    print(" val:  ", image_counts["val"])
    print("Re-train lesions with: python ai/train_conditions.py")


def main() -> None:
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--lesions", action="store_true", help="rebuild YOLO lesion dataset (default if no flags)")
    p.add_argument("--regions", action="store_true", help="rebuild image-level oily/dry/pores/redness/wrinkles set")
    args = p.parse_args()
    do_lesions = args.lesions or not args.regions
    do_regions = args.regions
    if do_lesions:
        merge_lesions()
    if do_regions:
        write_region_dataset()


if __name__ == "__main__":
    main()
