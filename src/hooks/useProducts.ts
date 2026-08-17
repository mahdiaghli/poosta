import { useEffect, useState } from 'react';
import { productService } from '@/services/productService';
import type { Product } from '@/types';

/** Thin data-fetching hook over productService with loading/error states. */
export function useProductCatalog() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    productService.getAll()
      .then((data) => { if (alive) setProducts(data); })
      .catch(() => { if (alive) setError('خطا در دریافت محصولات. اتصال اینترنت را بررسی کنید.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  return { products, loading, error };
}
