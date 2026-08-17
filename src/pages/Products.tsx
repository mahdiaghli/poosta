import { useEffect, useMemo, useState } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProductCard } from '@/components/product/ProductCard';
import { useAppStore } from '@/store/useAppStore';
import { CATEGORY_LABELS_FA, type ProductCategory } from '@/types';
import { useNavigate } from 'react-router-dom';
import { productService } from '@/services/productService';

const CATEGORIES: (ProductCategory | 'all')[] = ['all','cleanser','toner','essence','serum','moisturizer','sunscreen','treatment','body_care','lip_care'];

export default function Products() {
  const navigate = useNavigate();
  const recommended = useAppStore((s) => s.products);
  const [catalog, setCatalog] = useState<import('@/types').Product[]>([]);
  useEffect(() => {
    productService.getAll().then(setCatalog);
  }, []);
  const products = recommended.length ? recommended : catalog;
  const [filter, setFilter] = useState<ProductCategory | 'all'>('all');
  const [query, setQuery] = useState('');

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => (filter === 'all' || p.category === filter) && (!q || `${p.name} ${p.brand}`.toLowerCase().includes(q)));
  }, [products, filter, query]);

  return (
    <div>
      <TopBar eyebrow="کاتالوگ محصولات" />
      <h1 className="text-[22px] font-extrabold text-sageDeep">محصولات مناسب پوست شما</h1>
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="جست‌وجوی برند یا محصول…" className="w-full border-[1.5px] border-line rounded-sm px-4 py-3.5 text-[15px] bg-white mt-3" />
      {!products.length ? (
        <div className="mt-4"><EmptyState title="هنوز پیشنهادی نداریم" body="ابتدا یک اسکن پوست انجام دهید تا محصولات مناسب شما را پیدا کنیم." cta="اسکن پوست" onCta={() => navigate('/scan')} /></div>
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1.5 my-4">
            {CATEGORIES.map((c) => <Chip key={c} label={c === 'all' ? 'همه' : CATEGORY_LABELS_FA[c]} active={filter === c} onClick={() => setFilter(c)} className="whitespace-nowrap" />)}
          </div>
          {!list.length ? <EmptyState title="محصولی پیدا نشد" body="فیلتر یا عبارت جست‌وجو را تغییر دهید." /> : list.map((p) => <ProductCard key={p.id} product={p} />)}
        </>
      )}
    </div>
  );
}
