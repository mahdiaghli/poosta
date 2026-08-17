import type { Product, ScoredProduct } from '@/types';
import { CATEGORY_LABELS_FA } from '@/types';
import { useNavigate } from 'react-router-dom';

export function ProductCard({ product }: { product: Product | ScoredProduct }) {
  const scored = 'compatibility' in product ? product.compatibility : null;
  const navigate = useNavigate();
  return (
    <div onClick={() => navigate(`/products/${product.id}`)} className="flex gap-3.5 bg-white border border-line rounded-md p-3.5 mb-3 cursor-pointer">
      <div className="w-16 h-16 rounded-2xl flex-none flex items-center justify-center text-2xl bg-sageMist">
        {CATEGORY_ICON[product.category] ?? '🧴'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-[14.5px]">{product.name}</div>
        <div className="text-xs text-stone mb-1.5">{product.brand} · {CATEGORY_LABELS_FA[product.category]}</div>
        {product.price ? <div className="font-bold text-[13.5px] text-sageDeep">{product.price.toLocaleString('fa-IR')} {product.currency === 'IRR' || product.currency === 'IRT' ? 'تومان' : product.currency}</div> : <div className="text-xs text-stone">قیمت: برای نمایش از فروشنده ایرانی استعلام شود</div>}
        {product.iranAvailability && <div className="text-[11px] text-stone mt-1">دسترسی ایران: {product.iranAvailability === 'available' ? 'قابل تهیه' : 'نیازمند بررسی'}</div>}
        {scored && <>
          <div className="inline-block text-[11.5px] font-bold text-sageDeep bg-sageMist px-2.5 py-1 rounded-full mt-1.5">
            تطابق با پوست شما: {scored.score}٪
          </div>
          <div className="text-[11.5px] text-stone mt-1.5 leading-[1.7]">
            {scored.reasons.map((r, i) => <div key={'p' + i}>✓ {r}</div>)}
            {scored.negativeReasons.map((r, i) => <div key={'n' + i} className="text-coral">✕ {r}</div>)}
          </div>
        </>}
      </div>
    </div>
  );
}

const CATEGORY_ICON: Record<string, string> = {
  cleanser: '🧴', toner: '💦', essence: '🫧', serum: '💧', moisturizer: '🫙', sunscreen: '☀️',
  treatment: '✨', body_care: '🧼', lip_care: '💋',
};
