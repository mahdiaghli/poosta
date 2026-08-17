import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/ui/Button';
import { useAppStore } from '@/store/useAppStore';
import { barcodeService } from '@/services/barcodeService';
import { CATEGORY_LABELS_FA, type Product } from '@/types';

export default function Barcode() {
  const navigate = useNavigate();
  const addOwnedProduct = useAppStore((s) => s.addOwnedProduct);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Product | null | undefined>(undefined);

  const lookup = async () => {
    setLoading(true);
    const p = await barcodeService.lookup(code);
    setResult(p);
    setLoading(false);
  };

  const addAndReturn = (p: Product) => {
    addOwnedProduct({ id: 'mp_' + Date.now(), refId: p.id, name: p.name, category: p.category, activeIngredientKeys: p.activeIngredientKeys, addedVia: 'barcode' });
    navigate('/my-products');
  };

  return (
    <div>
      <TopBar showBack eyebrow="اسکن بارکد" />
      <h1 className="text-[21px] font-extrabold text-sageDeep">بارکد محصول را وارد کنید</h1>
      <p className="text-[14.5px] text-stone leading-[1.9] mt-2.5">در نسخه فعلی، بارکد را به‌صورت دستی وارد کنید. بعداً به دوربین و سرویس واقعی بارکد متصل می‌شود.</p>
      <div className="mt-4.5"><input value={code} onChange={(e) => setCode(e.target.value)} placeholder="مثلاً 6291234567890"
        className="w-full border-[1.5px] border-line rounded-sm px-4 py-3.5 text-[15px] bg-white" /></div>
      <div className="mt-3.5"><Button onClick={lookup} disabled={loading || !code.trim()}>{loading ? 'در حال جست‌وجو...' : 'جست‌وجو'}</Button></div>

      {result !== undefined && (
        <div className="mt-4.5">
          {result ? (
            <>
              <div className="flex gap-3.5 bg-white border border-line rounded-md p-3.5">
                <div className="w-16 h-16 rounded-2xl bg-sageMist flex items-center justify-center text-2xl flex-none">🧴</div>
                <div>
                  <div className="font-bold text-[14.5px]">{result.name}</div>
                  <div className="text-xs text-stone">{result.brand} · {CATEGORY_LABELS_FA[result.category]}</div>
                  <div className="font-bold text-sageDeep text-[13.5px] mt-1">{result.price ? `${result.price.toLocaleString('fa-IR')} تومان` : 'قیمت ثبت نشده'}</div>
                </div>
              </div>
              <div className="mt-3"><Button onClick={() => addAndReturn(result)}>افزودن به محصولات من</Button></div>
            </>
          ) : (
            <>
              <div className="bg-[#FBEEE9] text-coral rounded-md px-4 py-3.5 text-sm">محصولی با این بارکد پیدا نشد.</div>
              <div className="mt-3"><Button variant="secondary" onClick={() => navigate('/my-products')}>افزودن دستی محصول</Button></div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
