import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3, Check, CheckCircle2, ClipboardCheck, History,
  PackageSearch, Printer, Search, Send, UserRoundSearch,
} from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { clearStaffAuth, getStaffToken, pharmacyStaffService } from '@/services/pharmacyStaffService';
import { productService } from '@/services/productService';
import type { Product } from '@/types';
import { useAppStore } from '@/store/useAppStore';

type Tab = 'scans' | 'inventory' | 'analytics' | 'audit';
type Range = 'today' | 'week' | 'month';

const inputClass = 'w-full border border-line bg-white rounded-xl px-3 min-h-12 text-[13px] outline-none focus:border-sageDeep';

const actionLabels: Record<string, string> = {
  'staff.login': 'ورود کارکنان',
  'inventory.updated': 'ویرایش موجودی',
  'routine.sent': 'ارسال روتین',
  'scan.phone_saved': 'ثبت موبایل',
  'scan.routine_sent': 'ثبت ارسال روتین',
  'scan.share': 'ارسال دوباره روتین',
  'scan.print': 'چاپ برگه محصولات',
  'scan.follow_up': 'پیگیری مشتری',
  'scan.complete_visit': 'تکمیل مراجعه',
  'scan.note': 'یادداشت مراجعه',
  'device.activated': 'فعال‌سازی دستگاه',
  'device.revoked': 'لغو دستگاه',
  'subscription.renewed': 'تمدید اشتراک',
};

function beep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.frequency.value = 880;
    gain.gain.value = 0.05;
    oscillator.start();
    setTimeout(() => { oscillator.stop(); ctx.close(); }, 180);
  } catch { /* sound is an enhancement */ }
}

function inventoryBadge(product: any) {
  if (product.inventory_status === 'not_stocked') return ['در داروخانه ثبت نشده', 'bg-stone/10 text-stone'];
  if (product.inventory_status === 'out_of_stock') return ['ناموجود', 'bg-rose-50 text-rose-700'];
  if (product.inventory_status === 'low_stock') return ['رو به اتمام', 'bg-amber-50 text-amber-700'];
  return ['موجود در داروخانه', 'bg-emerald-50 text-emerald-700'];
}

function metricTalkingPoints(progress: any) {
  const diffs = Object.entries(progress?.progress?.metric_diffs || {}) as [string, number][];
  const changed = diffs.filter(([, value]) => Math.abs(Number(value)) >= 2).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  if (!changed.length) return ['تغییر محسوسی ثبت نشده؛ روی تداوم روتین و مصرف صحیح تأکید کنید.'];
  return changed.slice(0, 3).map(([key, value]) => (
    Number(value) > 0
      ? `${key}: ${Math.abs(Number(value))} امتیاز بهتر شده؛ روند فعلی را تقویت کنید.`
      : `${key}: ${Math.abs(Number(value))} امتیاز افت داشته؛ علت مصرف نامنظم یا محصول محرک را بررسی کنید.`
  ));
}

export default function PharmacyDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const requestedTab = new URLSearchParams(location.search).get('tab');
  const [tab, setTab] = useState<Tab>(requestedTab === 'inventory' || requestedTab === 'analytics' || requestedTab === 'audit' ? requestedTab : 'scans');
  const [scans, setScans] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [progress, setProgress] = useState<any | null>(null);
  const [customerMatches, setCustomerMatches] = useState<any[]>([]);
  const [phoneLookup, setPhoneLookup] = useState('');
  const [note, setNote] = useState('');
  const [inventory, setInventory] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [catalogMap, setCatalogMap] = useState<Map<string, Product>>(new Map());
  const [productQuery, setProductQuery] = useState('');
  const [analytics, setAnalytics] = useState<any | null>(null);
  const [range, setRange] = useState<Range>('today');
  const [audit, setAudit] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState('');
  const [error, setError] = useState('');
  const [invForm, setInvForm] = useState({
    product_id: '', price: '', stock: '', low_stock_threshold: '3', sku: '', available: true,
  });
  const knownIds = useRef<Set<string>>(new Set());
  const meta = pharmacyStaffService.getPharmacyMeta();
  const resetKioskSession = useAppStore((state) => state.resetKioskSession);

  useEffect(() => {
    if (!getStaffToken()) navigate('/pharmacy/login', { replace: true });
    productService.getAll().then((products) => setCatalogMap(new Map(products.map((product) => [product.id, product]))));
  }, [navigate]);

  const handleError = (value: unknown) => {
    const message = value instanceof Error ? value.message : 'خطایی رخ داد.';
    setError(message);
    if (message.includes('پرسنل') || message.includes('منقضی')) {
      clearStaffAuth();
      navigate('/pharmacy/login', { replace: true });
    }
  };

  const loadScans = async (notifyNew = false) => {
    try {
      const list = await pharmacyStaffService.todayScans();
      if (notifyNew) {
        for (const scan of list) {
          if (!knownIds.current.has(scan.scan_id)) {
            if (knownIds.current.size) beep();
            knownIds.current.add(scan.scan_id);
          }
        }
      } else {
        knownIds.current = new Set(list.map((scan: any) => scan.scan_id));
      }
      setScans(list);
      setError('');
    } catch (e) { handleError(e); }
  };

  const loadInventory = async () => {
    try { setInventory(await pharmacyStaffService.listProducts()); } catch (e) { handleError(e); }
  };

  const loadAnalytics = async (value: Range = range) => {
    try { setAnalytics(await pharmacyStaffService.analytics(value)); } catch (e) { handleError(e); }
  };

  const loadAudit = async () => {
    try { setAudit(await pharmacyStaffService.audit()); } catch (e) { handleError(e); }
  };

  useEffect(() => {
    Promise.all([loadScans(false), loadAnalytics('today')]).finally(() => setLoading(false));
    const timer = setInterval(() => loadScans(true), 4000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (tab === 'inventory') loadInventory();
    if (tab === 'analytics') loadAnalytics(range);
    if (tab === 'audit') loadAudit();
  }, [tab, range]);

  useEffect(() => {
    const query = productQuery.trim();
    if (query.length < 2) { setCatalog([]); return; }
    const timer = setTimeout(() => {
      pharmacyStaffService.searchCatalog(query).then(setCatalog).catch(handleError);
    }, 220);
    return () => clearTimeout(timer);
  }, [productQuery]);

  const openScan = async (scanId: string) => {
    setActionBusy('detail');
    try {
      const detail = await pharmacyStaffService.scanDetail(scanId);
      setSelected(detail);
      setNote('');
      setProgress(detail.phone ? await pharmacyStaffService.customerProgress(detail.phone) : null);
    } catch (e) { handleError(e); } finally { setActionBusy(''); }
  };

  const lookup = async () => {
    setActionBusy('lookup');
    try {
      const matches = await pharmacyStaffService.searchCustomers(phoneLookup);
      setCustomerMatches(matches);
      if (matches.length === 1) setProgress(await pharmacyStaffService.customerProgress(matches[0].phone));
      else setProgress(null);
      setSelected(null);
    } catch (e) { handleError(e); } finally { setActionBusy(''); }
  };

  const openCustomer = async (phone: string) => {
    setPhoneLookup(phone);
    setProgress(await pharmacyStaffService.customerProgress(phone));
    setCustomerMatches([]);
    setSelected(null);
  };

  const runAction = async (action: string) => {
    if (!selected) return;
    setActionBusy(action);
    try {
      const visit = await pharmacyStaffService.scanAction(selected.scan_id, action, note || undefined);
      setSelected({ ...selected, visit });
      if (action === 'note') {
        setNote('');
        if (selected.phone) setProgress(await pharmacyStaffService.customerProgress(selected.phone));
      }
      if (action === 'complete_visit') {
        resetKioskSession();
        setSelected(null);
      }
      await loadAnalytics('today');
    } catch (e) { handleError(e); } finally { setActionBusy(''); }
  };

  const printSelected = async () => {
    await runAction('print');
    if (selected) navigate(`/print/scan/${selected.scan_id}`);
  };

  const chooseProduct = (product: any) => {
    const current = product.inventory;
    setInvForm({
      product_id: product.id,
      price: current?.price != null ? String(current.price) : '',
      stock: current?.stock != null ? String(current.stock) : '',
      low_stock_threshold: String(current?.low_stock_threshold ?? 3),
      sku: current?.sku || '',
      available: current?.available ?? true,
    });
    setProductQuery(`${product.brand} — ${product.name}`);
    setCatalog([]);
  };

  const editInventory = (productId: string) => {
    const row = inventory.find((item) => item.product_id === productId);
    const product = catalogMap.get(productId);
    setInvForm({
      product_id: productId,
      price: row?.price != null ? String(row.price) : '',
      stock: row?.stock != null ? String(row.stock) : '',
      low_stock_threshold: String(row?.low_stock_threshold ?? 3),
      sku: row?.sku || '',
      available: row ? Boolean(row.available) : true,
    });
    setProductQuery(product ? `${product.brand} — ${product.name}` : productId);
    setSelected(null);
    setTab('inventory');
  };

  const saveInventory = async () => {
    if (!invForm.product_id) return;
    setActionBusy('inventory');
    try {
      await pharmacyStaffService.upsertProduct({
        product_id: invForm.product_id,
        price: invForm.price === '' ? null : Number(invForm.price),
        stock: Number(invForm.stock || 0),
        low_stock_threshold: Number(invForm.low_stock_threshold || 0),
        sku: invForm.sku || null,
        available: invForm.available,
      });
      setInvForm({ product_id: '', price: '', stock: '', low_stock_threshold: '3', sku: '', available: true });
      setProductQuery('');
      await Promise.all([loadInventory(), loadAnalytics('today')]);
    } catch (e) { handleError(e); } finally { setActionBusy(''); }
  };

  const checklist = selected?.visit?.checklist || {};
  const phoneSaved = Boolean(selected?.phone) || checklist.phone_saved;
  const talkingPoints = useMemo(() => metricTalkingPoints(progress), [progress]);

  return (
    <div dir="rtl">
      <TopBar eyebrow="پنل داروخانه" right={
        <button className="text-xs font-bold text-sageDeep" onClick={() => { clearStaffAuth(); navigate('/pharmacy/login'); }}>خروج</button>
      } />

      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="text-[21px] font-extrabold text-sageDeep">{meta?.name || 'داروخانه'}</h1>
          <p className="text-[12px] text-stone mt-1">صف کار روزانه، فروش و پیگیری مشتریان</p>
        </div>
        <div className="rounded-xl bg-white border border-line px-3 py-2 text-center min-w-[72px]">
          <div className="num text-lg font-extrabold text-sageDeep">{analytics?.scan_count ?? scans.length}</div>
          <div className="text-[10px] text-stone">اسکن امروز</div>
        </div>
      </div>

      {error && <div className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-[12px] text-rose-700">{error}</div>}

      <div className="grid grid-cols-4 gap-1 bg-sageMist rounded-2xl p-1 mb-4">
        {([
          ['scans', ClipboardCheck, 'مراجعات'],
          ['inventory', PackageSearch, 'موجودی'],
          ['analytics', BarChart3, 'گزارش'],
          ['audit', History, 'فعالیت'],
        ] as const).map(([key, Icon, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`rounded-xl py-2 flex flex-col items-center gap-1 text-[10.5px] font-bold ${tab === key ? 'bg-sageDeep text-white shadow-sm' : 'text-sageDeep'}`}>
            <Icon size={17} />{label}
          </button>
        ))}
      </div>

      {loading ? (
        <Card><div className="h-24 animate-pulse rounded-xl bg-sageMist" /></Card>
      ) : tab === 'scans' ? (
        <>
          <Card className="mb-3">
            <div className="flex items-center gap-2 text-[13px] font-bold text-sageDeep mb-2"><UserRoundSearch size={17} />جست‌وجوی مشتری</div>
            <div className="flex gap-2">
              <input value={phoneLookup} onChange={(e) => setPhoneLookup(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && lookup()} placeholder="حداقل ۳ رقم موبایل" className={inputClass} dir="ltr" inputMode="tel" />
              <button aria-label="جست‌وجو" onClick={lookup} disabled={actionBusy === 'lookup'} className="h-12 w-12 shrink-0 rounded-xl bg-sageDeep text-white flex items-center justify-center disabled:opacity-50"><Search size={20} /></button>
            </div>
            {customerMatches.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {customerMatches.map((customer) => (
                  <button key={customer.id} onClick={() => openCustomer(customer.phone)} className="w-full flex items-center justify-between rounded-xl border border-line px-3 py-2 text-right">
                    <span dir="ltr" className="num text-[13px]">{customer.phone}</span>
                    <span className="text-[11px] text-stone">{customer.scan_count} مراجعه</span>
                  </button>
                ))}
              </div>
            )}
          </Card>

          <div className="flex items-center justify-between mb-2">
            <h2 className="text-[13px] font-bold text-sageDeep">صف اسکن‌های امروز</h2>
            <span className="text-[11px] text-stone">به‌روزرسانی خودکار</span>
          </div>
          <div className="space-y-2 mb-4">
            {scans.map((scan) => (
              <button key={scan.scan_id} onClick={() => openScan(scan.scan_id)} className={`w-full text-right bg-white border rounded-2xl px-3.5 py-3 ${selected?.scan_id === scan.scan_id ? 'border-sageDeep ring-1 ring-sageDeep/20' : 'border-line'}`}>
                <div className="flex justify-between items-center gap-3">
                  <div>
                    <div className="text-[13px] font-bold">{scan.phone || 'مشتری بدون شماره'}</div>
                    <div className="text-[11px] text-stone mt-1">{new Date(scan.created_at).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })} · {scan.mode === 'accurate' ? 'تحلیل ابری' : 'تحلیل معمولی'}</div>
                  </div>
                  <div className="num h-11 w-11 shrink-0 rounded-full bg-sageMist text-sageDeep flex items-center justify-center font-extrabold">{scan.overallScore ?? '—'}</div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {(scan.concerns || []).slice(0, 3).map((concern: any) => <span key={String(concern?.name || concern)} className="rounded-full bg-blushSoft px-2 py-1 text-[10px] text-stone">{concern?.name || concern}</span>)}
                </div>
              </button>
            ))}
            {!scans.length && <Card><p className="text-center text-stone text-[13px] py-4">هنوز اسکنی برای امروز ثبت نشده است.</p></Card>}
          </div>

          {selected && (
            <Card className="mb-4 border-sageSoft">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h2 className="font-extrabold text-[15px] text-sageDeep">مراجعه {selected.phone || 'بدون شماره'}</h2>
                  <p className="text-[11.5px] text-stone mt-1">امتیاز پوست {selected.overallScore ?? '—'} · {selected.recommendations?.length || 0} پیشنهاد</p>
                </div>
                <button onClick={() => setSelected(null)} className="text-xs text-stone">بستن</button>
              </div>

              <div className="text-[12.5px] font-bold mb-2">محصولات پیشنهادی و وضعیت فروش</div>
              <div className="space-y-2 mb-4">
                {(selected.recommendations || []).map((product: any) => {
                  const [label, tone] = inventoryBadge(product);
                  return (
                    <div key={product.id || product.name} className="rounded-xl border border-line p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[12.5px] font-bold truncate">{product.name}</div>
                          <div className="text-[10.5px] text-stone mt-1">{product.brand || product.category}</div>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-1 text-[9.5px] font-bold ${tone}`}>{label}</span>
                      </div>
                      <div className="flex items-center justify-between mt-2 text-[11px] text-stone">
                        <span>{product.price != null ? `${Number(product.price).toLocaleString('fa-IR')} تومان` : 'قیمت ثبت نشده'}</span>
                        <button onClick={() => editInventory(product.id)} className="font-bold text-sageDeep">ویرایش سریع</button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-2xl bg-sageMist/70 p-3 mb-3">
                <div className="flex items-center gap-2 text-[12.5px] font-bold text-sageDeep mb-2"><ClipboardCheck size={17} />چک‌لیست پایان مراجعه</div>
                {[
                  [phoneSaved, 'شماره موبایل ذخیره شده'],
                  [checklist.routine_sent, 'روتین برای مشتری ارسال شده'],
                  [checklist.product_slip_printed, 'برگه محصولات چاپ شده'],
                  [checklist.visit_completed, 'مراجعه بسته شده'],
                ].map(([done, label]) => (
                  <div key={String(label)} className="flex items-center gap-2 py-1 text-[11.5px]">
                    <span className={`h-5 w-5 rounded-full flex items-center justify-center ${done ? 'bg-sageDeep text-white' : 'bg-white border border-line text-transparent'}`}><Check size={13} /></span>
                    <span className={done ? 'text-sageDeep font-bold' : 'text-stone'}>{label}</span>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2 mb-2">
                <Button className="min-h-11 py-2.5 text-[12px]" onClick={() => runAction('share')} disabled={!selected.phone || !selected.routine || Boolean(actionBusy)}><Send size={16} />ارسال دوباره روتین</Button>
                <Button variant="secondary" className="min-h-11 py-2.5 text-[12px]" onClick={printSelected} disabled={Boolean(actionBusy)}><Printer size={16} />چاپ برگه</Button>
              </div>
              <Button variant="secondary" className="min-h-11 py-2.5 text-[12px] mb-2" onClick={() => runAction('follow_up')} disabled={Boolean(actionBusy)}>ثبت پیگیری مشتری</Button>
              <div className="flex gap-2 mb-2">
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="یادداشت برای مراجعه بعدی" className={inputClass} />
                <button aria-label="ثبت یادداشت" onClick={() => runAction('note')} disabled={!note.trim() || Boolean(actionBusy)} className="h-12 w-12 shrink-0 rounded-xl border border-sageSoft text-sageDeep flex items-center justify-center disabled:opacity-40"><Check size={19} /></button>
              </div>
              <Button variant={checklist.visit_completed ? 'secondary' : 'primary'} onClick={() => runAction('complete_visit')} disabled={Boolean(actionBusy)}>
                <CheckCircle2 size={18} />{checklist.visit_completed ? 'مراجعه تکمیل شده' : 'تکمیل و بستن مراجعه'}
              </Button>
            </Card>
          )}

          {progress?.customer && (
            <Card className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-extrabold text-[15px] text-sageDeep">مشتری بازگشتی</h2>
                <span className="rounded-full bg-sageMist px-2 py-1 text-[10px] font-bold">{progress.scans?.length || 0} مراجعه</span>
              </div>
              <p dir="ltr" className="num text-[12px] text-stone text-right">{progress.customer.phone}</p>
              {progress.progress ? (
                <div className="mt-3 rounded-xl border border-line p-3">
                  <div className="text-[13px] font-bold">امتیاز کل: {progress.progress.prev_overall} ← {progress.progress.latest_overall} <span className={progress.progress.overall_diff >= 0 ? 'text-emerald-700' : 'text-rose-700'}>({progress.progress.overall_diff >= 0 ? '+' : ''}{progress.progress.overall_diff})</span></div>
                  <p className="text-[10.5px] text-stone mt-1">فاصله دو اسکن: {progress.progress.days_between} روز</p>
                </div>
              ) : <p className="text-[12px] text-stone mt-3">برای مقایسه روند، حداقل دو اسکن لازم است.</p>}
              <div className="mt-3">
                <div className="text-[12px] font-bold mb-1.5">نکات پیشنهادی برای گفت‌وگو</div>
                <ul className="space-y-1 text-[11.5px] text-stone">
                  {talkingPoints.map((point) => <li key={point}>• {point}</li>)}
                </ul>
              </div>
              <div className="mt-3 border-t border-line pt-3">
                <div className="text-[12px] font-bold mb-2">خط زمانی اسکن‌ها</div>
                <div className="space-y-1.5">
                  {(progress.scans || []).slice(0, 4).map((scan: any) => (
                    <div key={scan.scan_id} className="flex items-center justify-between text-[11px]">
                      <span>{new Date(scan.created_at).toLocaleDateString('fa-IR')}</span>
                      <span className="num font-bold text-sageDeep">امتیاز {scan.result?.overallScore ?? '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
              {progress.notes?.length > 0 && (
                <div className="mt-3 border-t border-line pt-3">
                  <div className="text-[12px] font-bold mb-1">آخرین یادداشت</div>
                  <p className="text-[11.5px] text-stone">{progress.notes[0].note}</p>
                </div>
              )}
            </Card>
          )}
        </>
      ) : tab === 'inventory' ? (
        <>
          <Card className="mb-3">
            <h2 className="font-extrabold text-[15px] text-sageDeep mb-1">افزودن یا ویرایش محصول</h2>
            <p className="text-[11px] text-stone mb-3">نام، برند، شناسه یا بارکد را جست‌وجو کنید.</p>
            <div className="relative mb-3">
              <Search size={17} className="absolute right-3 top-4 text-stone" />
              <input value={productQuery} onChange={(e) => { setProductQuery(e.target.value); setInvForm((value) => ({ ...value, product_id: '' })); }} placeholder="جست‌وجوی محصول" className={`${inputClass} pr-10`} />
              {catalog.length > 0 && (
                <div className="absolute z-10 top-[54px] inset-x-0 max-h-64 overflow-y-auto rounded-2xl border border-line bg-white shadow-card p-1">
                  {catalog.map((product) => (
                    <button key={product.id} onClick={() => chooseProduct(product)} className="w-full text-right rounded-xl px-3 py-2.5 hover:bg-sageMist">
                      <div className="text-[12.5px] font-bold">{product.name}</div>
                      <div className="text-[10.5px] text-stone mt-0.5">{product.brand} · {product.category}{product.inventory ? ' · ثبت‌شده در موجودی' : ''}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {invForm.product_id && <div className="mb-3 rounded-xl bg-sageMist px-3 py-2 text-[11px] text-sageDeep">شناسه: <span dir="ltr" className="num">{invForm.product_id}</span></div>}
            <div className="grid grid-cols-2 gap-2 mb-2">
              <input className={inputClass} placeholder="قیمت (تومان)" inputMode="numeric" value={invForm.price} onChange={(e) => setInvForm({ ...invForm, price: e.target.value })} />
              <input className={inputClass} placeholder="موجودی" inputMode="numeric" value={invForm.stock} onChange={(e) => setInvForm({ ...invForm, stock: e.target.value })} />
              <input className={inputClass} placeholder="هشدار موجودی کم" inputMode="numeric" value={invForm.low_stock_threshold} onChange={(e) => setInvForm({ ...invForm, low_stock_threshold: e.target.value })} />
              <input className={inputClass} placeholder="SKU داروخانه" dir="ltr" value={invForm.sku} onChange={(e) => setInvForm({ ...invForm, sku: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 text-[12px] text-stone mb-3">
              <input type="checkbox" checked={invForm.available} onChange={(e) => setInvForm({ ...invForm, available: e.target.checked })} /> قابل فروش در داروخانه
            </label>
            <Button onClick={saveInventory} disabled={!invForm.product_id || actionBusy === 'inventory'}>ذخیره موجودی</Button>
          </Card>

          <div className="flex items-center justify-between mb-2">
            <h2 className="text-[13px] font-bold text-sageDeep">موجودی داروخانه</h2>
            <span className="text-[11px] text-stone">{inventory.length} محصول</span>
          </div>
          <div className="space-y-2">
            {inventory.map((row) => {
              const product = catalogMap.get(row.product_id);
              const low = Boolean(row.available) && Number(row.stock) <= Number(row.low_stock_threshold ?? 3);
              return (
                <button key={row.id} onClick={() => editInventory(row.product_id)} className="w-full text-right rounded-2xl border border-line bg-white p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0"><div className="truncate text-[12.5px] font-bold">{product?.name || row.product_id}</div><div className="text-[10.5px] text-stone mt-1">{product?.brand || row.sku || 'بدون SKU'}</div></div>
                    <span className={`rounded-full px-2 py-1 text-[9.5px] font-bold ${!row.available || row.stock <= 0 ? 'bg-rose-50 text-rose-700' : low ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{!row.available || row.stock <= 0 ? 'ناموجود' : low ? 'رو به اتمام' : `موجودی ${row.stock}`}</span>
                  </div>
                  <div className="mt-2 text-[11px] text-stone">{row.price != null ? `${Number(row.price).toLocaleString('fa-IR')} تومان` : 'قیمت ثبت نشده'} · هشدار در {row.low_stock_threshold ?? 3}</div>
                </button>
              );
            })}
            {!inventory.length && <Card><p className="text-center text-[12px] text-stone py-3">هنوز محصولی در موجودی ثبت نشده است.</p></Card>}
          </div>
        </>
      ) : tab === 'analytics' ? (
        <>
          <div className="grid grid-cols-3 gap-1.5 mb-3">
            {([['today', 'امروز'], ['week', '۷ روز'], ['month', '۳۰ روز']] as const).map(([value, label]) => (
              <button key={value} onClick={() => setRange(value)} className={`rounded-full py-2 text-[11px] font-bold ${range === value ? 'bg-sageDeep text-white' : 'bg-white border border-line text-sageDeep'}`}>{label}</button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2.5 mb-3">
            {[
              [analytics?.scan_count ?? 0, 'تعداد اسکن'],
              [analytics?.average_score ?? '—', 'میانگین امتیاز'],
              [analytics?.routine_sent_count ?? 0, 'روتین ارسال‌شده'],
              [analytics?.print_count ?? 0, 'برگه چاپ‌شده'],
              [analytics?.returning_customers ?? 0, 'مشتری بازگشتی'],
              [analytics?.low_stock_count ?? 0, 'موجودی رو به اتمام'],
            ].map(([value, label]) => <Card key={String(label)} className="p-3 text-center"><div className="num text-xl font-extrabold text-sageDeep">{value}</div><div className="text-[10.5px] text-stone mt-1">{label}</div></Card>)}
          </div>
          <Card className="mb-3">
            <h2 className="text-[13px] font-bold text-sageDeep mb-2">نگرانی‌های پرتکرار</h2>
            <div className="space-y-2">{analytics?.top_concerns?.length ? analytics.top_concerns.map((item: any) => <div key={item.key} className="flex justify-between text-[12px]"><span>{item.key}</span><span className="num font-bold">{item.count}</span></div>) : <p className="text-[12px] text-stone">داده کافی وجود ندارد.</p>}</div>
          </Card>
          <Card className="mb-3">
            <h2 className="text-[13px] font-bold text-sageDeep mb-2">محصولات پیشنهادی پرتکرار</h2>
            <div className="space-y-2">{analytics?.top_recommended_products?.length ? analytics.top_recommended_products.map((item: any) => <div key={item.key} className="flex justify-between gap-2 text-[12px]"><span className="truncate">{item.key}</span><span className="num font-bold">{item.count}</span></div>) : <p className="text-[12px] text-stone">داده کافی وجود ندارد.</p>}</div>
          </Card>
          <Card>
            <div className="flex items-center justify-between"><h2 className="text-[13px] font-bold text-sageDeep">مجوز و دستگاه‌ها</h2><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${analytics?.license?.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{analytics?.license?.status || '—'}</span></div>
            <p className="text-[11px] text-stone mt-2">پلن {analytics?.license?.plan || '—'} · اعتبار تا {analytics?.license?.expires_at ? new Date(analytics.license.expires_at).toLocaleDateString('fa-IR') : '—'}</p>
            <div className="mt-3 space-y-2">{analytics?.devices?.map((device: any) => <div key={device.id} className="rounded-xl border border-line px-3 py-2"><div className="flex justify-between text-[11.5px] font-bold"><span>{device.device_code}</span><span className={device.status === 'active' ? 'text-emerald-700' : 'text-rose-700'}>{device.status}</span></div><p className="text-[10px] text-stone mt-1">آخرین اتصال: {device.last_seen ? new Date(device.last_seen).toLocaleString('fa-IR') : 'ثبت نشده'}</p></div>)}</div>
          </Card>
        </>
      ) : (
        <Card>
          <h2 className="font-extrabold text-[15px] text-sageDeep mb-3">تاریخچه فعالیت کارکنان و دستگاه</h2>
          <div className="space-y-3">
            {audit.map((event) => (
              <div key={event.id} className="flex gap-3 border-b border-line pb-3 last:border-0 last:pb-0">
                <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-sageDeep" />
                <div className="min-w-0"><div className="text-[12.5px] font-bold">{actionLabels[event.event_type] || event.event_type}</div><div className="text-[10.5px] text-stone mt-1">{new Date(event.created_at).toLocaleString('fa-IR')}{event.metadata?.product_id ? ` · ${event.metadata.product_id}` : ''}</div></div>
              </div>
            ))}
            {!audit.length && <p className="text-center text-[12px] text-stone py-4">هنوز فعالیتی ثبت نشده است.</p>}
          </div>
        </Card>
      )}
    </div>
  );
}
