# Local Skin AI setup

بدون Supabase و بدون Gemini کار می‌کند.

```bash
npm run ai:install
npm run api
```

## هر شاخص از کجا میاد

| شاخص | روش | دیتاست/مدل واقعی پیدا شد؟ |
|---|---|---|
| **Acne** | مدل YOLO آموزش‌دیده | ✅ از قبل در پروژه (`datasets/skin/acne/`) |
| **Fine lines / چروک** | **مدل واقعی U-Net (FFHQ-Wrinkle)** اگه checkpoint باشه، وگرنه Canny edge-density | ✅ کد و مدل pretrained واقعاً پیدا و کلون شد |
| **Dark spots / لک** | LAB threshold (self-referential) | ❌ MVNFP جعلی از آب درومد — پایین توضیح دادم |
| **Redness, Texture, Pores, Oiliness** | LAB/HSV/Laplacian کلاسیک | ❌ دیتاست تخصصی عمومی پیدا نشد (پایین توضیح) |
| **Hydration** | اندازه‌گیری نمی‌شه (نیاز به سنسور) | — |

## چیزی که واقعاً پیدا و اضافه شد

### ✅ Wrinkles — FFHQ-Wrinkle (واقعی و استفاده‌شدنی)
`datasets/skin/wrinkles/ffhq-wrinkle/` کلون شد (کد+inference، ~2MB). این مدل واقعیه:
مقاله ICPR 2024، ۱۰۰۰ ماسک دستی + ۵۰٬۰۰۰ ماسک ضعیف روی FFHQ، pretrained U-Net/SwinUNETR منتشرشده.

**کاری که باید بکنید:**
1. از [این لینک گوگل‌درایو](https://drive.google.com/drive/folders/1Z4EagkkhdIGxDjYrxM7Gkr6sfpvXUUTs) فایل `stage2_wrinkle_finetune_unet/stage2_unet.pth` رو دانلود کنید.
2. بذاریدش تو: `models/skin/wrinkles/stage2_unet.pth`
3. سرور رو ری‌استارت کنید؛ `ai/wrinkle_model.py` خودکار مدل واقعی رو لود می‌کنه، وگرنه fallback به heuristic کلاسیک.

⚠️ **لایسنس CC BY-NC-SA 4.0 = غیرتجاری.** برای استفاده تجاری باید با نویسنده‌های FFHQ و FFHQ-Wrinkle هماهنگ کنید.

⚠️ **یک تقریب مهم**: این مدل به یک کانال چهارم «texture map» نیاز داره که روش تولیدش برای عکس دلخواه (غیر از FFHQ) عمومی منتشر نشده؛ من به‌جاش از edge-map خودمون (Canny) استفاده کردم — تقریب معقول ولی validate نشده. جزئیات در `ai/wrinkle_model.py`.

### ✅ SCIN — برای diversity/robustness (نه یک مدل مستقیم)
`datasets/skin/general/scin/` کلون شد (کد+demo notebook، ~500KB). دیتاست واقعیه (Google + Stanford، ۱۰٬۰۰۰+ عکس، برچسب Fitzpatrick/Monk Skin Tone) ولی خودِ عکس‌ها روی Google Cloud Storage عمومی هستن، نه توی این ریپو (چون این سندباکس فقط به GitHub دسترسی داره، نه GCS). برای دانلود واقعی عکس‌ها:
```bash
pip install gcsfs pandas
# راهنما: datasets/skin/general/scin/scin_demo.ipynb
```
**استفاده پیشنهادی**: نه برای «تشخیص pore»، بلکه برای calibration/robustness — یعنی تست کنید مدل‌های کلاسیک ما (رنگ/بافت) رو روی طیف رنگ پوست متنوع‌تر تا bias نداشته باشن.

### ⚠️ Fitzpatrick17k — نیمه‌واقعی
`datasets/skin/diversity/fitzpatrick17k/` کلون شد (CSV واقعی + `train.py`). **ولی**: خودِ عکس‌ها redistribute نشدن؛ فقط URL دارید (`fitzpatrick17k.csv`) که به دو آتلاس درماتولوژی لینک می‌ده و بخشی از لینک‌ها مرده‌ست. برای مجموعه کامل باید فرمی که تو README ریپو هست پر کنید. **مصرف پیشنهادی همینه که تو متن خودتون گفته بودید: bias calibration، نه training مستقیم برای «نوع پوست».**

## چیزی که پیدا نشد و واقعاً وجود نداره (صادقانه بگم)

- **MVNFP (پیگمنتیشن)**: ریپوی `github.com/sunshiding/MVNFP` که مقاله بهش اشاره می‌کنه رو چک کردم — فقط یک README خالیه، هیچ داده/کدی منتشر نشده. یعنی این دیتاست عملاً **در دسترس عموم نیست**، برخلاف چیزی که مقاله ادعا می‌کنه.
  - **جایگزین واقعی که پیدا شد**: دیتاست [Pigmentation Melasma Dark Spots](https://universe.roboflow.com/alirho/pigmentation-melasma-dark-spots-436l2-cybdd) روی Roboflow (۸۱۹ عکس + مدل pretrained + API آماده). نکته مهم: استفاده از API آماده‌شون یعنی دوباره به یک **API key شخص ثالث** (Roboflow) نیاز دارید — دقیقاً همون چیزی که گفتید نمی‌خواید. اگه فقط برای **لیبل‌زدن/export دیتاست و آموزش محلی** ازش استفاده کنید (نه inference از API اونا)، دیگه به key نیازی در runtime نیست.
- **Facial Pore Dataset (PS-Net, 3750 عکس)**: این یک دیتاست **اختصاصی/داخلی** شرکته (۱۸ نفر، دستگاه eMR Pro مخصوص). هیچ لینک دانلود عمومی پیدا نشد. عملاً غیرقابل‌دسترسه.
- **FacialSKIN (texture/pigmentation severity)**: خودِ متن شما هم گفته بود «دسترسی محدود است» — تأیید می‌کنم، لینک دانلود عمومی پیدا نکردم.

### نتیجه
از ۶ مورد (لک، چروک، منافذ، عمومی/diversity، Fitzpatrick، بافت):
- **۲ تا واقعاً real و usable بودن** (چروک FFHQ-Wrinkle، SCIN) → کلون و wire شدن.
- **۱ تا نیمه** (Fitzpatrick17k — labels واقعی، عکس‌ها نیاز به scrape/فرم دارن).
- **۳ تا (لک/پیگمنتیشن دقیق، منافذ تخصصی، بافت با severity) عملاً دیتاست عمومی معتبری ندارن** — همون heuristic کلاسیک فعلی (بدون دیتاست) منطقی‌ترین مسیره، مگر بخواید خودتون داده جمع کنید یا از دیتاست‌های folder-classification با annotation ضعیف‌تر (مثل Kaggle که خودتون اشاره کردید) فقط برای pretraining استفاده کنید.

## آکنه (بدون تغییر)

```bash
python ai/train_acne.py --data datasets/skin/acne/data.yaml --epochs 50 --device 0
python ai/export_model.py --weights models/skin/acne/runs/acne/weights/best.pt
```

## اجرا

```bash
npm run api
```
