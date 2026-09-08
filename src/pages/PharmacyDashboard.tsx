import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { clearStaffAuth, getStaffToken, pharmacyStaffService } from '@/services/pharmacyStaffService';

function beep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 880; g.gain.value = 0.05;
    o.start();
    setTimeout(() => { o.stop(); ctx.close(); }, 180);
  } catch { /* */ }
}

export default function PharmacyDashboard() {
  const navigate = useNavigate();
  const [scans, setScans] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [progress, setProgress] = useState<any | null>(null);
  const [phoneLookup, setPhoneLookup] = useState('');
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'scans' | 'inventory'>('scans');
  const [inventory, setInventory] = useState<any[]>([]);
  const [invForm, setInvForm] = useState({ product_id: '', price: '', stock: '' });
  const knownIds = useRef<Set<string>>(new Set());
  const meta = pharmacyStaffService.getPharmacyMeta();

  useEffect(() => {
    if (!getStaffToken()) navigate('/pharmacy/login', { replace: true });
  }, [navigate]);

  const loadScans = async (notifyNew: boolean) => {
    try {
      const list = await pharmacyStaffService.todayScans();
      if (notifyNew) {
        for (const s of list) {
          if (!knownIds.current.has(s.scan_id)) {
            if (knownIds.current.size > 0) beep();
            knownIds.current.add(s.scan_id);
          }
        }
      } else {
        knownIds.current = new Set(list.map((s: any) => s.scan_id));
      }
      setScans(list);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا');
      if (String((e as Error).message).includes('پرسنل')) {
        clearStaffAuth();
        navigate('/pharmacy/login', { replace: true });
      }
    }
  };

  useEffect(() => {
    loadScans(false);
    const t = setInterval(() => loadScans(true), 4000);
    return () => clearInterval(t);
  }, []);

  const openScan = async (scanId: string) => {
    const detail = await pharmacyStaffService.scanDetail(scanId);
    setSelected(detail);
    setProgress(null);
    if (detail.phone) {
      try { setProgress(await pharmacyStaffService.customerProgress(detail.phone)); } catch { /* */ }
    }
  };

  const lookup = async () => {
    setProgress(await pharmacyStaffService.customerProgress(phoneLookup));
    setSelected(null);
  };

  const loadInv = async () => {
    setInventory(await pharmacyStaffService.listProducts());
  };

  useEffect(() => {
    if (tab === 'inventory') loadInv().catch((e) => setError(e.message));
  }, [tab]);

  const saveInv = async () => {
    await pharmacyStaffService.upsertProduct({
      product_id: invForm.product_id,
      price: Number(invForm.price),
      stock: Number(invForm.stock),
      available: true,
    });
    setInvForm({ product_id: '', price: '', stock: '' });
    await loadInv();
  };

  return (
    <div>
      <TopBar eyebrow="پنل داروخانه" right={
        <button className="text-xs font-bold text-sageDeep" onClick={() => { clearStaffAuth(); navigate('/pharmacy/login'); }}>خروج</button>
      } />
      <h1 className="text-[20px] font-extrabold text-sageDeep">{meta?.name || 'داروخانه'}</h1>
      <p className="text-[12px] text-stone mt-1">اسکن‌های امروز · اعلان صوتی برای مشتری جدید</p>
      {error && <p className="text-rose-700 text-[12.5px] mt-2">{error}</p>}

      <div className="flex bg-sageMist rounded-full p-1 mt-4 mb-3">
        {([['scans', 'اسکن‌ها'], ['inventory', 'موجودی']] as const).map(([k, label]) => (
          <div key={k} onClick={() => setTab(k)}
            className={`flex-1 text-center py-2 rounded-full text-[13px] font-bold cursor-pointer ${tab === k ? 'bg-sageDeep text-white' : 'text-sageDeep'}`}>
            {label}
          </div>
        ))}
      </div>

      {tab === 'scans' ? (
        <>
          <Card className="mb-3">
            <div className="text-[12.5px] font-bold mb-2">جست‌وجوی مشتری با موبایل (پیشرفت)</div>
            <div className="flex gap-2">
              <input value={phoneLookup} onChange={(e) => setPhoneLookup(e.target.value)} placeholder="09…" className="flex-1 border border-line rounded-xl px-3 py-2" dir="ltr" />
              <Button onClick={lookup}>برو</Button>
            </div>
          </Card>

          <div className="text-[13px] font-bold text-sageDeep mb-2">امروز — {scans.length} اسکن</div>
          <div className="space-y-2 mb-4">
            {scans.map((s) => (
              <button key={s.scan_id} onClick={() => openScan(s.scan_id)}
                className="w-full text-right bg-white border border-line rounded-md px-3 py-3">
                <div className="flex justify-between text-[13px] font-bold">
                  <span>{s.phone || 'بدون شماره'}</span>
                  <span className="num">{s.overallScore ?? '—'}</span>
                </div>
                <div className="text-[11px] text-stone mt-1">{new Date(s.created_at).toLocaleTimeString('fa-IR')} · {s.mode}</div>
              </button>
            ))}
            {!scans.length && <p className="text-stone text-[13px]">هنوز اسکنی ثبت نشده.</p>}
          </div>

          {selected && (
            <Card className="mb-4">
              <h2 className="font-bold text-[15px] mb-2">جزئیات اسکن</h2>
              <p className="text-[12.5px] text-stone">موبایل: {selected.phone || '—'}</p>
              <p className="text-[12.5px] text-stone mb-2">امتیاز: {selected.overallScore ?? '—'}</p>
              <div className="text-[13px] font-bold mb-1">محصولات پیشنهادی</div>
              <ul className="text-[12.5px] space-y-1 mb-3">
                {(selected.recommendations || []).map((p: any) => (
                  <li key={p.id || p.name}>
                    ✓ {p.name} {p.price != null ? `— ${Number(p.price).toLocaleString('fa-IR')} تومان` : ''}
                    {p.stock != null ? ` (موجودی ${p.stock})` : ''}
                    {p.available === false ? ' — ناموجود' : ''}
                  </li>
                ))}
              </ul>
              <div className="flex flex-col gap-2">
                <Button onClick={() => navigate(`/print/scan/${selected.scan_id}`)}>چاپ لیست محصولات برای فروشنده</Button>
                <Button variant="secondary" onClick={() => setSelected(null)}>بستن</Button>
              </div>
            </Card>
          )}

          {progress?.progress && (
            <Card className="mb-4">
              <h2 className="font-bold text-[15px] mb-2">پیشرفت نسبت به مراجعه قبل</h2>
              <p className="text-[13px]">
                امتیاز: {progress.progress.prev_overall} → {progress.progress.latest_overall}
                {' '}({progress.progress.overall_diff >= 0 ? '+' : ''}{progress.progress.overall_diff})
              </p>
              <p className="text-[11.5px] text-stone mt-1">{progress.progress.days_between} روز فاصله</p>
            </Card>
          )}
          {progress && !progress.progress && progress.scans?.length > 0 && (
            <Card className="mb-4"><p className="text-[13px] text-stone">اولین مراجعه ثبت‌شده — هنوز مقایسه‌ای نیست.</p></Card>
          )}
        </>
      ) : (
        <Card>
          <h2 className="font-bold mb-3">موجودی / قیمت داروخانه</h2>
          <div className="space-y-2 mb-4">
            {inventory.map((p) => (
              <div key={p.id} className="text-[12.5px] flex justify-between border-b border-line py-2">
                <span>{p.product_id}</span>
                <span>{Number(p.price || 0).toLocaleString('fa-IR')} · موجودی {p.stock}</span>
              </div>
            ))}
          </div>
          <input className="w-full border border-line rounded-xl px-3 py-2 mb-2" placeholder="product_id" value={invForm.product_id} onChange={(e) => setInvForm({ ...invForm, product_id: e.target.value })} />
          <div className="flex gap-2 mb-2">
            <input className="flex-1 border border-line rounded-xl px-3 py-2" placeholder="قیمت" value={invForm.price} onChange={(e) => setInvForm({ ...invForm, price: e.target.value })} />
            <input className="flex-1 border border-line rounded-xl px-3 py-2" placeholder="موجودی" value={invForm.stock} onChange={(e) => setInvForm({ ...invForm, stock: e.target.value })} />
          </div>
          <Button onClick={saveInv}>ذخیره</Button>
        </Card>
      )}
    </div>
  );
}
