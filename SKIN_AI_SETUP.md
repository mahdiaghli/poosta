# Local Skin AI setup

این نسخه بدون Supabase و بدون Gemini کار می‌کند.

## 1) نصب Python dependencies

```bash
npm run ai:install
```

## 2) دیتاست آکنه

داده‌های YOLO را در این مسیر قرار دهید:

```text
datasets/skin/acne/
  images/train
  images/val
  labels/train
  labels/val
  data.yaml
```

ساختار annotation در `datasets/skin/acne/README.md` توضیح داده شده است.

## 3) Fine-tune

```bash
python ai/train_acne.py --data datasets/skin/acne/data.yaml --epochs 50 --device 0
```

برای CPU `--device cpu` استفاده کنید.

Ultralytics آموزش transfer learning از checkpoint pretrained و export به ONNX را پشتیبانی می‌کند. citeturn285981search0turn285981search4

## 4) Export

```bash
python ai/export_model.py --weights models/skin/acne/runs/acne/weights/best.pt
```

سپس فایل خروجی را به این نام قرار دهید:

```text
models/skin/acne/best.onnx
```

## 5) اجرا

فقط کافی است API پروژه را اجرا کنید:

```bash
npm run api
```

`server.js` سرویس Python را روی پورت 8788 خودکار بالا می‌آورد و frontend از `/api/skin-analysis` استفاده می‌کند.

## وضعیت فعلی مدل

مدل فعلی فقط برای **تشخیص ضایعات آکنه** طراحی شده است. شاخص‌های قرمزی، لک، بافت، منافذ، چربی، رطوبت و خطوط ریز هنوز مدل اختصاصی ندارند و عمداً مقدار پیش‌فرض 50 می‌گیرند تا نتیجه جعلی تولید نشود.

برای هر شاخص بعداً یک مدل جدا یا یک multi-task model اضافه کنید.
