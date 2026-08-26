"""Merge 2+ Roboflow YOLO-detection exports into ONE multi-class dataset.

Why: ardayemc/skin-problem-detection and dental-caries-mlx7r/face-skin-problems
are both YOLO-format object-detection exports but with different, overlapping
class lists (e.g. both have "Acne", only one has "Wrinkles"). This script reads
each dataset's own data.yaml (never hardcodes class names -- Roboflow class
order/spelling varies per export), builds one unified class list, and copies
+ remaps every label file into datasets/skin/conditions/.

Usage:
  1. Unzip each downloaded Roboflow dataset into:
       datasets/skin/conditions_raw/ardayemc/          (must contain data.yaml, train/, valid/)
       datasets/skin/conditions_raw/face_skin_problems/
     (add more folders under conditions_raw/ the same way if you find others later)
  2. python ai/merge_condition_datasets.py
  3. Output: datasets/skin/conditions/{images,labels}/{train,val}/ + data.yaml
"""
from __future__ import annotations
import shutil
from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "datasets/skin/conditions_raw"
OUT_DIR = ROOT / "datasets/skin/conditions"


def normalize(name: str) -> str:
    return name.strip().lower().replace("_", "-").replace(" ", "-")


def find_split_dir(dataset_dir: Path, split: str) -> Path | None:
    # Roboflow exports use train/valid/test OR train/val -- handle both.
    candidates = [dataset_dir / split, dataset_dir / ("val" if split == "valid" else "valid")]
    for c in candidates:
        if (c / "images").exists():
            return c
    return None


def main() -> None:
    dataset_dirs = [d for d in RAW_DIR.iterdir() if d.is_dir() and (d / "data.yaml").exists()]
    if not dataset_dirs:
        raise SystemExit(f"No datasets found in {RAW_DIR}. Unzip each Roboflow export into its own subfolder first.")

    # 1) build the unified class list from all datasets' own data.yaml
    unified: list[str] = []
    per_dataset_map: dict[Path, dict[int, int]] = {}
    for d in dataset_dirs:
        names = yaml.safe_load((d / "data.yaml").read_text())["names"]
        names = names if isinstance(names, list) else [names[i] for i in sorted(names)]
        remap: dict[int, int] = {}
        for local_idx, name in enumerate(names):
            key = normalize(name)
            existing = next((i for i, n in enumerate(unified) if normalize(n) == key), None)
            if existing is None:
                unified.append(name)
                existing = len(unified) - 1
            remap[local_idx] = existing
        per_dataset_map[d] = remap
        print(f"{d.name}: {len(names)} classes -> {names}")

    print(f"\nUnified classes ({len(unified)}): {unified}\n")

    # 2) copy + remap every image/label into the merged output
    for split_out, split_in_candidates in [("train", ["train"]), ("val", ["valid", "val"])]:
        (OUT_DIR / "images" / split_out).mkdir(parents=True, exist_ok=True)
        (OUT_DIR / "labels" / split_out).mkdir(parents=True, exist_ok=True)

    for d in dataset_dirs:
        remap = per_dataset_map[d]
        for split_out, split_in_candidates in [("train", ["train"]), ("val", ["valid", "val"])]:
            src = None
            for s in split_in_candidates:
                cand = d / s
                if (cand / "images").exists():
                    src = cand
                    break
            if src is None:
                continue
            for img in (src / "images").glob("*"):
                dst_img = OUT_DIR / "images" / split_out / f"{d.name}__{img.name}"
                shutil.copy2(img, dst_img)
                label_src = src / "labels" / (img.stem + ".txt")
                dst_label = OUT_DIR / "labels" / split_out / f"{d.name}__{img.stem}.txt"
                if label_src.exists():
                    lines_out = []
                    for line in label_src.read_text().splitlines():
                        parts = line.split()
                        if not parts:
                            continue
                        cls = int(parts[0])
                        parts[0] = str(remap.get(cls, cls))
                        lines_out.append(" ".join(parts))
                    dst_label.write_text("\n".join(lines_out))
                else:
                    dst_label.write_text("")  # background image, no boxes

    (OUT_DIR / "data.yaml").write_text(yaml.safe_dump({
        "path": "datasets/skin/conditions",
        "train": "images/train",
        "val": "images/val",
        "names": {i: n for i, n in enumerate(unified)},
    }, allow_unicode=True, sort_keys=False))
    print(f"Done. Merged dataset at {OUT_DIR}, train/val counts:")
    print(" train:", len(list((OUT_DIR / "images/train").glob("*"))))
    print(" val:  ", len(list((OUT_DIR / "images/val").glob("*"))))


if __name__ == "__main__":
    main()
