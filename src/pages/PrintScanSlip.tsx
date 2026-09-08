import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { pharmacyStaffService, getStaffToken } from '@/services/pharmacyStaffService';
import { Button } from '@/components/ui/Button';

/** Printable product slip for the shop assistant — uses browser Print → local printer. */
export default function PrintScanSlip() {
  const { scanId } = useParams();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!scanId) return;
    if (!getStaffToken()) {
      setError('ابتدا وارد پنل داروخانه شوید.');
      return;
    }
    pharmacyStaffService.scanDetail(scanId)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [scanId]);

  useEffect(() => {
    if (data) {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [data]);

  if (error) return <div className="p-6 text-rose-700">{error}</div>;
  if (!data) return <div className="p-6 text-stone">در حال آماده‌سازی برگه چاپ…</div>;

  const products = data.recommendations || [];
  const morning = data.routine?.morning || [];
  const night = data.routine?.night || [];

  return (
    <div className="max-w-[480px] mx-auto p-4 bg-white text-black print:p-0">
      <div className="print:hidden mb-3"><Button onClick={() => window.print()}>چاپ مجدد</Button></div>
      <h1 className="text-lg font-bold">پوستا — لیست محصولات برای فروشنده</h1>
      <p className="text-xs mt-1">اسکن: {data.scan_id}</p>
      <p className="text-xs">موبایل مشتری: {data.phone || '—'}</p>
      <p className="text-xs">امتیاز پوست: {data.overallScore ?? '—'} · ساعت: {new Date(data.created_at).toLocaleString('fa-IR')}</p>
      <hr className="my-3" />
      <h2 className="font-bold text-sm mb-2">محصولات پیشنهادی (تحویل از قفسه)</h2>
      <ol className="text-sm space-y-1 list-decimal mr-5">
        {products.map((p: any, i: number) => (
          <li key={i}>
            {p.name}{p.brand ? ` — ${p.brand}` : ''}
            {p.price != null ? ` | ${Number(p.price).toLocaleString('fa-IR')} تومان` : ''}
            {p.stock != null ? ` | موجودی ${p.stock}` : ''}
            {p.available === false ? ' | ناموجود' : ''}
          </li>
        ))}
      </ol>
      {!products.length && <p className="text-sm text-stone">محصولی ثبت نشده — از کiosk دوباره handoff کنید.</p>}
      <hr className="my-3" />
      <h2 className="font-bold text-sm mb-1">صبح</h2>
      <ul className="text-xs space-y-0.5 mb-2">
        {morning.map((s: any, i: number) => <li key={i}>{s.name} — {s.productName}</li>)}
      </ul>
      <h2 className="font-bold text-sm mb-1">شب</h2>
      <ul className="text-xs space-y-0.5">
        {night.map((s: any, i: number) => <li key={i}>{s.name} — {s.productName}</li>)}
      </ul>
      <p className="text-[10px] mt-4 text-stone">این برگه تشخیص پزشکی نیست. برای کمک فروشنده در انتخاب محصول است.</p>
    </div>
  );
}
