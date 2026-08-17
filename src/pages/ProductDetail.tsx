import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { productService } from '@/services/productService';
import { MedicalDisclaimer } from '@/components/ui/MedicalDisclaimer';
import { useAppStore } from '@/store/useAppStore';
import type { Product } from '@/types';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const startPatchTest = useAppStore((s) => s.startPatchTest);
  useEffect(() => { productService.getById(id ?? '').then(setProduct); }, [id]);

  if (!product) return <div><TopBar eyebrow="محصول" /><p className="text-stone mt-6">محصول پیدا نشد.</p></div>;
  return (
    <div>
      <TopBar eyebrow={product.brand} />
      <Card>
        <div className="text-[26px] mb-2">{product.category === 'sunscreen' ? '☀️' : product.category === 'cleanser' ? '🧴' : '✨'}</div>
        <h1 className="text-[22px] font-extrabold text-sageDeep">{product.name}</h1>
        <div className="text-stone mt-1.5">{product.brand}</div>
        {product.price ? <div className="font-bold text-sageDeep mt-3">{product.price.toLocaleString('fa-IR')} تومان</div> : <div className="text-stone mt-3">قیمت فعلی از فروشنده استعلام شود.</div>}
        <div className="grid grid-cols-2 gap-2 mt-4 text-sm">
          <Info title="نوع پوست" value={product.skinTypes.join('، ') || '—'} />
          <Info title="دغدغه‌ها" value={product.concerns.join('، ') || '—'} />
          <Info title="مواد فعال" value={product.activeIngredientKeys.join('، ') || '—'} />
          <Info title="مصرف" value={`${product.amUsage ? 'صبح' : ''}${product.amUsage && product.pmUsage ? ' و ' : ''}${product.pmUsage ? 'شب' : ''}` || '—'} />
        </div>
        {product.notes && <p className="text-sm text-stone leading-7 mt-4">{product.notes}</p>}
        <div className="grid grid-cols-2 gap-2 mt-4"><Button onClick={() => navigate('/my-products')}>افزودن به محصولات من</Button><Button variant="secondary" onClick={() => { startPatchTest(product.name, product.id); navigate('/patch-test'); }}>🧪 Patch Test</Button></div>{(product.pregnancySafety || product.interactionIds?.length) && <div className="mt-4 bg-[#FBEEE9] rounded-md p-3 text-xs leading-6"><b>⚠️ نکات ایمنی</b>{product.pregnancySafety ? <><br/>وضعیت بارداری/شیردهی: {product.pregnancySafety}</> : null}{product.interactionIds?.length ? <><br/>تداخل‌های احتمالی: {product.interactionIds.join('، ')}</> : null}</div>}<MedicalDisclaimer />
      </Card>
    </div>
  );
}
function Info({ title, value }: { title: string; value: string }) {
  return <div className="border border-line rounded-md p-3 bg-white"><div className="text-xs text-stone">{title}</div><div className="font-bold mt-1 text-[12.5px] leading-6">{value}</div></div>;
}
