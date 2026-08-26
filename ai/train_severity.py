"""Train a multi-task severity/condition classifier from one or more Roboflow
CLASSIFICATION exports (each folder has its own _classes.csv sitting next to
its images -- e.g. datasets/skin/severity/pigmentation/_classes.csv,
datasets/skin/severity/pores/_classes.csv, ...).

Why "multi-task": each folder is a DIFFERENT set of photos labeled for its
OWN condition(s) (pigmentation photos aren't also labeled for pores). So we
build one shared model with one output per discovered label column across
ALL folders, and mask the loss per-sample to only the column(s) that folder
actually provides. This lets pigmentation photos improve the shared visual
backbone even though they only supervise the "Pigmentation" output.

Usage:
  python ai/train_severity.py                 # auto-discovers every _classes.csv under datasets/skin/severity/
  python ai/train_severity.py --epochs 20
  python ai/train_severity.py --dry-run        # just print what it found, no training
"""
from __future__ import annotations
from pathlib import Path
import argparse
import pandas as pd
import numpy as np
import torch
from torch import nn
from torch.utils.data import Dataset, DataLoader, random_split
from torchvision import transforms, models
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "datasets/skin/severity"
OUT_DIR = ROOT / "models/skin/severity"

TRANSFORM = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])


def discover(data_dir: Path) -> list[tuple[Path, pd.DataFrame, list[str]]]:
    """Finds every _classes.csv under data_dir. Returns (folder, df, label_cols)."""
    found = []
    for csv_path in data_dir.rglob("_classes.csv"):
        df = pd.read_csv(csv_path)
        df.columns = [c.strip() for c in df.columns]
        filename_col = next((c for c in df.columns if c.lower() in ("filename", "file", "image")), df.columns[0])
        label_cols = [c for c in df.columns if c != filename_col and pd.api.types.is_numeric_dtype(df[c])]
        if not label_cols:
            print(f"  ! skipping {csv_path} -- no numeric label columns found")
            continue
        df = df.rename(columns={filename_col: "__filename__"})
        found.append((csv_path.parent, df, label_cols))
    return found


class MultiFolderDataset(Dataset):
    """Concatenates samples across folders. Each sample carries a mask so the
    loss only applies to the columns that folder actually labels."""
    def __init__(self, sources: list[tuple[Path, pd.DataFrame, list[str]]], all_cols: list[str]):
        self.rows: list[tuple[Path, str, np.ndarray, np.ndarray]] = []  # (folder, filename, values, mask)
        for folder, df, label_cols in sources:
            col_idx = [all_cols.index(c) for c in label_cols]
            for _, row in df.iterrows():
                values = np.zeros(len(all_cols), dtype=np.float32)
                mask = np.zeros(len(all_cols), dtype=np.float32)
                for c, i in zip(label_cols, col_idx):
                    values[i] = float(row[c])
                    mask[i] = 1.0
                self.rows.append((folder, str(row["__filename__"]), values, mask))

    def __len__(self) -> int:
        return len(self.rows)

    def __getitem__(self, idx: int):
        folder, filename, values, mask = self.rows[idx]
        img_path = folder / filename
        if not img_path.exists():  # fallback: sometimes nested under train/valid/test subfolders
            matches = list(folder.rglob(filename))
            if not matches:
                raise FileNotFoundError(f"Image not found: {img_path}")
            img_path = matches[0]
        img = Image.open(img_path).convert("RGB")
        return TRANSFORM(img), torch.from_numpy(values), torch.from_numpy(mask)


def build_model(n_outputs: int) -> nn.Module:
    net = models.resnet18(weights=models.ResNet18_Weights.IMAGENET1K_V1)
    net.fc = nn.Linear(net.fc.in_features, n_outputs)
    return net


def masked_mse(pred: torch.Tensor, target: torch.Tensor, mask: torch.Tensor) -> torch.Tensor:
    diff2 = (pred - target) ** 2 * mask
    denom = mask.sum().clamp_min(1.0)
    return diff2.sum() / denom


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--data-dir", default=str(DATA_DIR))
    p.add_argument("--epochs", type=int, default=20)
    p.add_argument("--batch", type=int, default=32)
    p.add_argument("--lr", type=float, default=1e-4)
    p.add_argument("--device", default="cuda" if torch.cuda.is_available() else "cpu")
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()

    data_dir = Path(args.data_dir)
    sources = discover(data_dir)
    if not sources:
        raise SystemExit(f"No _classes.csv found under {data_dir}. Unzip each Roboflow classification export as its own subfolder there.")

    all_cols: list[str] = []
    print(f"Found {len(sources)} labeled folder(s):")
    for folder, df, label_cols in sources:
        for c in label_cols:
            if c not in all_cols:
                all_cols.append(c)
        vmin, vmax = df[label_cols].min().min(), df[label_cols].max().max()
        print(f"  {folder.relative_to(data_dir)}: {len(df)} rows, columns={label_cols}, value range=[{vmin}, {vmax}]")
    print(f"\nUnified output columns ({len(all_cols)}): {all_cols}\n")

    if args.dry_run:
        return

    dataset = MultiFolderDataset(sources, all_cols)
    val_len = max(1, int(0.15 * len(dataset)))
    train_ds, val_ds = random_split(dataset, [len(dataset) - val_len, val_len])
    train_loader = DataLoader(train_ds, batch_size=args.batch, shuffle=True, num_workers=2)
    val_loader = DataLoader(val_ds, batch_size=args.batch, num_workers=2)

    model = build_model(len(all_cols)).to(args.device)
    opt = torch.optim.AdamW(model.parameters(), lr=args.lr)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    best_val = float("inf")
    for epoch in range(args.epochs):
        model.train()
        train_loss = 0.0
        for x, y, mask in train_loader:
            x, y, mask = x.to(args.device), y.to(args.device), mask.to(args.device)
            opt.zero_grad()
            loss = masked_mse(model(x), y, mask)
            loss.backward()
            opt.step()
            train_loss += loss.item() * x.size(0)
        train_loss /= len(train_ds)

        model.eval()
        val_loss = 0.0
        with torch.no_grad():
            for x, y, mask in val_loader:
                x, y, mask = x.to(args.device), y.to(args.device), mask.to(args.device)
                val_loss += masked_mse(model(x), y, mask).item() * x.size(0)
        val_loss /= len(val_ds)
        print(f"epoch {epoch+1}/{args.epochs}  train_mse={train_loss:.4f}  val_mse={val_loss:.4f}")

        if val_loss < best_val:
            best_val = val_loss
            torch.save({"state_dict": model.state_dict(), "label_cols": all_cols}, OUT_DIR / "best.pth")

    print(f"Best val MSE: {best_val:.4f}. Saved to {OUT_DIR / 'best.pth'}")


if __name__ == "__main__":
    main()