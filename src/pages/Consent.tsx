import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAppStore } from '@/store/useAppStore';

const POINTS = [
  ['عکس شما برای چه استفاده می‌شود؟', 'فقط برای استخراج شاخص‌های ظاهری پوست (مثل خشکی، جوش، قرمزی) در همین دستگاه/سرویس تحلیل.'],
  ['آیا ذخیره می‌شود؟', 'تصویر اصلی برای ذخیره‌سازی نگه‌داری نمی‌شود. در صورت فعال بودن حساب، داده‌های اسکن روی سرویس خارجی ذخیره نمی‌شود؛ وضعیت فعلی روی همین دستگاه نگه‌داری می‌شود.'],
  ['چه مدت نگهداری می‌شود؟', 'تا زمانی که شما حساب‌تان را دارید یا از صفحه «حریم خصوصی» حذفش کنید.'],
  ['آیا برای آموزش AI استفاده می‌شود؟', 'خیر — مگر با رضایت جداگانه و صریح شما.'],
  ['آیا شخص ثالث دسترسی دارد؟', 'فقط اگر خودتان «تحلیل با دقت» را انتخاب کنید — آن‌وقت عکس برای همان یک تحلیل به Gemini یا OpenRouter ارسال می‌شود. در «تحلیل معمولی»، عکس هیچ‌وقت از سرور ما خارج نمی‌شود.'],
  ['چطور حذفش کنم؟', 'در هر زمان از «پروفایل ← حریم خصوصی ← حذف تاریخچه/حساب».'],
];

export default function Consent() {
  const navigate = useNavigate();
  const setConsent = useAppStore((s) => s.setFaceDataConsent);
  const user = useAppStore((s) => s.user);
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
