import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import { Button } from '@/components/ui/Button';

/** Kiosk-side print slip from in-memory recommendations (browser → shop printer). */
export default function PrintKioskSlip() {
  const navigate = useNavigate();
  const products = useAppStore((s) => s.products);
  const routine = useAppStore((s) => s.routine);
  const lastScan = useAppStore((s) => s.lastScan);
  const phone = useAppStore((s) => s.kioskPhone);

  useEffect(() => {
    if (!products.length && !routine) return;
    const t = setTimeout(() => window.print(), 350);
    return () => clearTimeout(t);
  }, [products, routine]);

  if (!lastScan) {
    return (
      <div className="p-6">
        <p className="text-stone mb-3">اسکن فعالی برای چاپ نیست.</p>
        <Button onClick={() => navigate('/scan')}>اسکن</Button>
      </div>
    );
  }

  return (
    <div className="max-w-[480px] mx-auto p-4 bg-white text-black">
      <div className="print:hidden mb-3 flex gap-2">
        <Button onClick={() => window.print()}>چاپ</Button>
        <Button variant="secondary" onClick={() => navigate(-1)}>بازگشت</Button>
      </div>
      <h1 className="text-lg font-bold">پوستا — لیست محصولات برای فروشنده</h1>
      <p className="text-xs mt-1">موبایل: {phone || '—'}</p>
      <p className="text-xs">امتیاز پوست: {lastScan.overallScore}</p>
      <hr className="my-3" />
      <h2 className="font-bold text-sm mb-2">محصولات پیشنهادی</h2>
      <ol className="text-sm space-y-1 list-decimal mr-5">
        {products.slice(0, 12).map((p) => (
          <li key={p.id}>
            {p.name}{p.brand ? ` — ${p.brand}` : ''}
            {p.price != null ? ` | ${Number(p.price).toLocaleString('fa-IR')} تومان` : ''}
          </li>
        ))}
      </ol>
      <hr className="my-3" />
      <h2 className="font-bold text-sm mb-1">صبح</h2>
      <ul className="text-xs mb-2">
        {(routine?.morning || []).map((s, i) => <li key={i}>{s.name} — {s.productName}</li>)}
      </ul>
      <h2 className="font-bold text-sm mb-1">شب</h2>
      <ul className="text-xs">
        {(routine?.night || []).map((s, i) => <li key={i}>{s.name} — {s.productName}</li>)}
      </ul>
      <p className="text-[10px] mt-4 text-stone">لطفاً این برگه را به فروشنده بدهید. تشخیص پزشکی نیست.</p>
    </div>
  );
}
