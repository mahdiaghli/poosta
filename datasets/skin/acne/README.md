# Acne dataset

Put labeled YOLO detection data here:

- `images/train/*.jpg` + `labels/train/*.txt`
- `images/val/*.jpg` + `labels/val/*.txt`

Each label line:

```text
class_id x_center y_center width height
```

All coordinates are normalized to 0..1. This project currently expects one class: `acne_lesion`.

Do not train on random web images. Use a dataset whose license permits your intended use and keep a clinician-reviewed validation set for evaluation.
