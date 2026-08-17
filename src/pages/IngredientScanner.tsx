import { useState } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/ui/Button';
import { useAppStore } from '@/store/useAppStore';
import { ingredientService, type IngredientScanResult } from '@/services/ingredientService';

export default function IngredientScanner() {
  const profile = useAppStore((s) => s.profile);
  const [text, setText] = useState('');
  const [result, setResult] = useState<IngredientScanResult | null>(null);

  const analyze = () => setResult(ingredientService.analyzeText(text, profile));

  return (
    <div>
      <TopBar eyebrow="اسکنر مواد تشکیل‌دهنده" />
      <h1 className="text-[22px] font-extrabold text-sageDeep">ترکیبات محصول را بررسی کنید</h1>
      <p className="text-[14.5px] text-stone leading-[1.9] mt-2.5">فهرست مواد تشکیل‌دهنده را تایپ کنید یا با کاما از هم جدا کنید (مثال: Niacinamide, Fragrance, Retinol)</p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="مثلاً: Niacinamide, Hyaluronic Acid, Fragrance"
        className="w-full border-[1.5px] border-line rounded-sm p-3.5 text-sm min-h-[100px] bg-white mt-3.5" />
      <div className="mt-3"><Button onClick={analyze}>بررسی ترکیبات</Button></div>

      {result?.conflicts.map((c, i) => (
        <div key={i} className="bg-[#FBEEE9] border border-[#F0CFC3] text-coral rounded-md px-4 py-3.5 text-[13px] leading-[1.9] mt-4">
          <b className="block mb-1">⚠ تداخل احتمالی ترکیبات</b>{c.message}
        </div>
      ))}

      <div className="mt-4">
        {result?.matches.length ? result.matches.map((m, i) => (
          <div key={i} className="flex items-center justify-between bg-white border border-line rounded-md px-4 py-3.5 mb-2.5">
            <div>
              <div className="font-bold text-sm">{m.info?.name ?? m.token}</div>
              <div className="text-xs text-stone mt-1 leading-[1.7] max-w-[230px]">
                {m.info ? <>{m.info.name} — عملکرد: {m.info.benefits}<br />ارتباط با پوست شما: {m.status === 'warn' ? m.info.possibleWarnings : 'با پروفایل پوستی شما سازگار است.'}</> : 'این ماده در پایگاه داده ما ثبت نشده است.'}
              </div>
            </div>
            <span className={`text-xs font-bold px-3 py-1.5 rounded-full flex-none mr-2.5 ${m.status === 'good' ? 'bg-sageMist text-sageDeep' : 'bg-[#FBEEE9] text-coral'}`}>
              {m.status === 'good' ? '✓ سازگار' : m.status === 'warn' ? '⚠ نیاز به احتیاط' : '؟ ناشناخته'}
            </span>
          </div>
        )) : <p className="text-[14.5px] text-stone mt-0">ابتدا فهرست ترکیبات را وارد کنید.</p>}
      </div>
    </div>
  );
}
