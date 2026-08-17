import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAppStore } from '@/store/useAppStore';
import { productService } from '@/services/productService';
import { CATEGORY_LABELS_FA, type Product, type ProductCategory } from '@/types';

const METHODS: [string, string, () => void][] = [];

export default function MyProducts() {
  const navigate = useNavigate();
  const myProducts = useAppStore((s) => s.myProducts);
  const addOwnedProduct = useAppStore((s) => s.addOwnedProduct);
  const removeOwnedProduct = useAppStore((s) => s.removeOwnedProduct);
  const buildRoutineFromOwned = useAppStore((s) => s.buildRoutineFromOwned);
  const setOwnedProductDates = useAppStore((s) => s.setOwnedProductDates);
  const lastScan = useAppStore((s) => s.lastScan);

  const [mode, setMode] = useState<'none' | 'search' | 'manual'>('none');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [manualName, setManualName] = useState('');
  const [manualCat, setManualCat] = useState<ProductCategory>('cleanser');

  const search = async (q: string) => {
    setQuery(q);
    setResults(q.trim() ? await productService.search(q) : []);
  };

  const addFromCatalog = (p: Product) => {
    addOwnedProduct({ id: crypto.randomUUID(), refId: p.id, name: p.name, category: p.category, activeIngredientKeys: p.activeIngredientKeys, addedVia: 'search' });
    setMode('none'); setQuery(''); setResults([]);
  };

  const addManual = () => {
    if (!manualName.trim()) return;
    addOwnedProduct({ id: crypto.randomUUID(), name: manualName.trim(), category: manualCat, activeIngredientKeys: [], addedVia: 'manual' });
    setManualName(''); setMode('none');
  };

  const buildFromMine = () => {
    if (!myProducts.length) return;
    if (!lastScan) { navigate('/scan'); return; }
    buildRoutineFromOwned();
    navigate('/routine');
  };

  return (
    <div>
      <TopBar eyebrow="محصولات من" />
      <h1 className="text-[22px] font-extrabold text-sageDeep">کمد محصولات پوستی شما</h1>
      <p className="text-[14.5px] text-stone leading-[1.9] mt-2.5">محصولاتی که در حال حاضر استفاده می‌کنید را اضافه کنید تا روتین بر اساس آن‌ها ساخته شود.</p>

      <div className="grid grid-cols-2 gap-2.5 my-4">
        <MethodCard icon="🔍" label="جست‌وجوی محصول" onClick={() => setMode('search')} />
        <MethodCard icon="📷" label="اسکن بارکد" onClick={() => navigate('/barcode')} />
        <MethodCard icon="🖼️" label="عکس محصول" onClick={() => setMode('search')} />
        <MethodCard icon="✍️" label="افزودن دستی" onClick={() => setMode('manual')} />
      </div>

      {mode === 'search' && (
        <div className="mb-4">
          <input value={query} onChange={(e) => search(e.target.value)} placeholder="نام محصول را جست‌وجو کنید…"
            className="w-full border-[1.5px] border-line rounded-sm px-4 py-3.5 text-[15px] bg-white" />
          <div className="mt-2.5">
            {results.map((p) => (
              <div key={p.id} className="flex items-center gap-3 bg-white border border-line rounded-md p-3 mb-2">
                <span className="text-sm flex-1 font-bold">{p.name} <span className="text-stone font-normal">— {p.brand}</span></span>
                <Button variant="secondary" className="w-auto px-3.5 py-2" onClick={() => addFromCatalog(p)}>افزودن</Button>
              </div>
            ))}
            {query && !results.length && <p className="text-[14.5px] text-stone mt-0">موردی یافت نشد.</p>}
          </div>
        </div>
      )}

      {mode === 'manual' && (
        <Card className="mb-4">
          <label className="text-[13px] font-bold text-sageDeep mb-2.5 block">نام محصول</label>
          <input value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="مثلاً کرم ضدآفتاب من"
            className="w-full border-[1.5px] border-line rounded-sm px-4 py-3.5 text-[15px] bg-white" />
          <label className="text-[13px] font-bold text-sageDeep mb-2.5 block mt-3">دسته‌بندی</label>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(CATEGORY_LABELS_FA) as ProductCategory[]).map((c) => (
              <Chip key={c} label={CATEGORY_LABELS_FA[c]} active={manualCat === c} onClick={() => setManualCat(c)} />
            ))}
          </div>
          <div className="mt-3.5"><Button onClick={addManual}>افزودن به کمد</Button></div>
        </Card>
      )}

      <h2 className="text-[17px] font-bold mb-3.5">محصولات ثبت‌شده</h2>
      {!myProducts.length ? (
        <EmptyState title="کمد شما خالی است" body="محصولاتی که استفاده می‌کنید را با یکی از روش‌های بالا اضافه کنید." />
      ) : (
        myProducts.map((p) => {
          const expiresSoon = p.expiresAt ? (new Date(p.expiresAt).getTime() - Date.now()) < 14 * 86400000 : false;
          return <div key={p.id} className="bg-white border border-line rounded-md p-3 mb-2.5">
            <div className="flex items-center gap-3">
              <span className="w-[26px] h-[26px] rounded-full bg-sageMist text-sageDeep flex items-center justify-center flex-none">✓</span>
              <span className="flex-1 font-bold text-[13.5px]">{p.name} <span className="text-stone font-normal">— {CATEGORY_LABELS_FA[p.category]}</span></span>
              <button onClick={() => removeOwnedProduct(p.id)} className="text-stone text-lg">✕</button>
            </div>
            <div className="flex gap-2 mt-2 items-center text-[11px] text-stone">
              <label>باز شدن <input type="date" value={p.openedAt?.slice(0,10) ?? ''} onChange={e=>setOwnedProductDates(p.id,e.target.value?new Date(e.target.value).toISOString():undefined,p.expiresAt)} className="border border-line rounded px-1.5 py-1" /></label>
              <label>انقضا <input type="date" value={p.expiresAt?.slice(0,10) ?? ''} onChange={e=>setOwnedProductDates(p.id,p.openedAt,e.target.value?new Date(e.target.value).toISOString():undefined)} className="border border-line rounded px-1.5 py-1" /></label>
            </div>
            {expiresSoon && <div className="text-xs text-coral font-bold mt-2">⚠️ کمتر از ۱۴ روز تا تاریخ انقضا مانده است.</div>}
          </div>
        }) )}
      <div className="mt-2.5"><Button variant="secondary" onClick={buildFromMine}>ساخت روتین از محصولات من</Button></div>
    </div>
  );
}

function MethodCard({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <div onClick={onClick} className="bg-white border border-line rounded-md p-4 text-center cursor-pointer">
      <div className="text-[22px] mb-1.5">{icon}</div><div className="text-[12.5px] font-bold">{label}</div>
    </div>
  );
}
