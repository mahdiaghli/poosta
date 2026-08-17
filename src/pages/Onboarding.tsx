import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { useAppStore } from '@/store/useAppStore';
import type { SkinProfile } from '@/types';

type StepType = 'number' | 'single' | 'multi';
interface StepDef { key: keyof SkinProfile; title: string; type: StepType; placeholder?: string; options?: [string, string][]; }

const STEPS: StepDef[] = [
  { key: 'age', title: 'چند سالتان است؟', type: 'number', placeholder: 'مثلاً ۲۶' },
  { key: 'gender', title: 'جنسیت شما؟', type: 'single', options: [['زن', 'female'], ['مرد', 'male'], ['ترجیح می‌دهم نگویم', 'na']] },
  { key: 'skinType', title: 'نوع پوستتان را می‌دانید؟', type: 'single', options: [['چرب', 'oily'], ['خشک', 'dry'], ['مختلط', 'combination'], ['نرمال', 'normal'], ['نمی‌دانم', 'unknown']] },
  { key: 'sensitivities', title: 'آیا پوستتان حساسیتی دارد؟', type: 'multi', options: [['حساس به آفتاب', 'sun'], ['حساس به عطر', 'fragrance'], ['مستعد آکنه', 'acne_prone'], ['هیچ‌کدام', 'none']] },
  { key: 'isPregnantOrNursing', title: 'آیا باردار هستید یا در دوران شیردهی؟', type: 'single', options: [['بله', 'yes'], ['خیر', 'no']] },
  { key: 'concerns', title: 'بیشتر با کدام مشکل مواجه‌اید؟', type: 'multi', options: [['جوش', 'acne'], ['چربی پوست', 'oiliness'], ['خشکی', 'hydration'], ['قرمزی', 'redness'], ['منافذ باز', 'pores'], ['لک', 'darkSpots']] },
  { key: 'goals', title: 'هدف شما از استفاده چیست؟', type: 'multi', options: [['کاهش جوش', 'acne'], ['کاهش لک', 'spots'], ['کاهش قرمزی', 'redness'], ['کنترل چربی', 'oil'], ['افزایش رطوبت', 'hydration'], ['بهبود بافت پوست', 'texture'], ['مراقبت و پیشگیری', 'prevent']] },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const profile = useAppStore((s) => s.profile);
  const setProfile = useAppStore((s) => s.setProfile);
  const [step, setStep] = useState(0);
  const s = STEPS[step];

  const finish = () => navigate('/consent');
  const next = () => (step < STEPS.length - 1 ? setStep(step + 1) : finish());
  const prev = () => (step > 0 ? setStep(step - 1) : navigate('/welcome'));

  const current = profile[s.key] as unknown;

  return (
    <div className="flex flex-col min-h-[calc(100vh-140px)]">
      <div className="flex items-center justify-between mb-5">
        <button onClick={prev} className="w-9 h-9 rounded-full bg-white border border-line flex items-center justify-center">←</button>
        <button onClick={finish} className="text-stone font-semibold text-sm">رد شدن</button>
      </div>
      <div className="flex gap-1.5 mb-5">
        {STEPS.map((_, i) => <span key={i} className={`h-[5px] flex-1 rounded-full ${i <= step ? 'bg-sageDeep' : 'bg-line'}`} />)}
      </div>

      <h1 className="text-[21px] font-extrabold text-sageDeep">{s.title}</h1>

      {s.type === 'number' && (
        <div className="mt-5">
          <input type="number" className="w-full border-[1.5px] border-line rounded-sm px-4 py-3.5 text-[15px] bg-white"
            placeholder={s.placeholder} value={(current as number) ?? ''}
            onChange={(e) => setProfile({ [s.key]: Number(e.target.value) } as Partial<SkinProfile>)} />
        </div>
      )}

      {s.type === 'single' && (
        <div className="mt-5 flex flex-col gap-2.5">
          {s.options!.map(([label, val]) => {
            const isBool = s.key === 'isPregnantOrNursing';
            const optVal: unknown = isBool ? val === 'yes' : val;
            const isCurrent = isBool ? current === optVal : current === val;
            return (
              <div key={val} onClick={() => setProfile({ [s.key]: optVal } as Partial<SkinProfile>)}
                className={`flex items-center justify-between rounded-md border-[1.5px] px-4.5 py-3.5 cursor-pointer ${isCurrent ? 'border-sageDeep bg-sageMist' : 'border-line bg-white'}`}>
                <span>{label}</span><span>{isCurrent ? '●' : '○'}</span>
              </div>
            );
          })}
        </div>
      )}

      {s.type === 'multi' && (
        <div className="mt-5 flex flex-wrap gap-2.5">
          {s.options!.map(([label, val]) => {
            const arr = (current as string[]) ?? [];
            const active = arr.includes(val);
            return (
              <Chip key={val} label={label} active={active} onClick={() => {
                const next = active ? arr.filter((v) => v !== val) : [...arr, val];
                setProfile({ [s.key]: next } as Partial<SkinProfile>);
              }} />
            );
          })}
        </div>
      )}

      <div className="mt-auto pt-5">
        <Button onClick={next}>ادامه</Button>
      </div>
    </div>
  );
}
