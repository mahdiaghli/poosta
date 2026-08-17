import { productService } from './productService';
import type { Product } from '@/types';

/**
 * barcodeService — thin, UI-friendly wrapper around productService's
 * barcode lookup. Swap point for a real barcode/camera API: replace the
 * `scan()` implementation to decode a live camera frame into a code string,
 * then keep calling productService.findByBarcode(code) unchanged.
 */
export const barcodeService = {
  async lookup(code: string): Promise<Product | null> {
    return productService.findByBarcode(code.trim());
  },
};
