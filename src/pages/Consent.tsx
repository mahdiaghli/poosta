import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAppStore } from '@/store/useAppStore';

const POINTS = [
  ['عکس شما برای چه استفاده می‌شود؟', 'برای استخراج شاخص‌های ظاهری پوست (مثل خشکی، جوش، قرمزی) و ساخت روتین مراقبتی.'],
  ['آیا ذخیره می‌شود؟', 'روی سرور پوستا، تصویر اصلی به‌همراه برچسب‌های داخلی آموزش (فقط برای تیم پوستا) به‌صورت خصوصی نگه داشته می‌شود و به‌صورت عمومی در دسترس نیست. نتیجهٔ مشتری فقط امتیازها و متن است، بدون تصویر حاشیه‌نویسی‌شده.'],
  ['چه مدت نگهداری می‌شود؟', 'تا وقتی برای ارائهٔ سرویس و بهبود کیفیت لازم باشد، یا تا زمانی که از صفحه «حریم خصوصی» حذف را درخواست کنید.'],
  ['آیا برای آموزش AI استفاده می‌شود؟', 'ممکن است برای بهبود مدل‌های پوستا در آینده استفاده شود؛ آموزش مدل به‌صورت دستی توسط تیم پوستا انجام می‌شود و روی دستگاه شما خودکار اجرا نمی‌شود.'],
  ['آیا شخص ثالث دسترسی دارد؟', 'فقط اگر خودتان «تحلیل با دقت» را انتخاب کنید — آن‌وقت عکس برای همان یک تحلیل به Gemini یا OpenRouter ارسال می‌شود. در «تحلیل معمولی»، عکس هیچ‌وقت از سرور ما خارج نمی‌شود.'],
  ['چطور حذفش کنم؟', 'در هر زمان از «پروفایل ← حریم خصوصی ← حذف تاریخچه/حساب».'],
];

export default function Consent() {
  const navigate = useNavigate();
  const setConsent = useAppStore((s) => s.setFaceDataConsent);
  const [checked, setChecked] = useState(false);

  return (
    <div>
      <TopBar showBack eyebrow="داده‌های چهره شما" />
      <h1 className="text-[21px] font-extrabold text-sageDeep mb-3">قبل از اسکن، این را بخوانید</h1>
      <Card className="mb-4">
        {POINTS.map(([q, a]) => (
          <div key={q} className="py-2.5 border-b border-line last:border-none">
            <div className="font-bold text-[13.5px]">{q}</div>
            <div className="text-[12.5px] text-stone mt-1 leading-[1.8]">{a}</div>
          </div>
        ))}
      </Card>
      <label className="flex items-start gap-2.5 text-[13.5px] mb-4 cursor-pointer">
        <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-1" />
        با پردازش تصویر چهره برای تحلیل پوست، طبق توضیحات بالا موافقم.
      </label>
      <Button disabled={!checked} onClick={() => { setConsent(true); navigate('/scan'); }}>ادامه</Button>
    </div>
  );
}
