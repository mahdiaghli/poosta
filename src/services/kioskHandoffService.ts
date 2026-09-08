import { deviceLicenseService } from './deviceLicenseService';
import type { Routine, ScoredProduct } from '@/types';

const PHONE_KEY = 'poosta:kioskPhone';
const SCAN_KEY = 'poosta:lastServerScanId';

export function getKioskPhone() {
  try { return localStorage.getItem(PHONE_KEY) || ''; } catch { return ''; }
}
export function setKioskPhone(phone: string) {
  try { localStorage.setItem(PHONE_KEY, phone); } catch { /* */ }
}
export function getLastServerScanId() {
  try { return localStorage.getItem(SCAN_KEY); } catch { return null; }
}
export function setLastServerScanId(id: string | null) {
  try {
    if (id) localStorage.setItem(SCAN_KEY, id);
    else localStorage.removeItem(SCAN_KEY);
  } catch { /* */ }
}

export const kioskHandoffService = {
  async handoff(opts: {
    scanId?: string | null;
    phone?: string;
    routine: Routine | null;
    products: ScoredProduct[];
  }) {
    const scanId = opts.scanId || getLastServerScanId();
    if (!scanId) return null;
    const recommendations = (opts.products || []).slice(0, 12).map((p) => ({
      id: p.id,
      name: p.name,
      brand: p.brand,
      category: p.category,
      score: p.score,
      price: p.price,
    }));
    const res = await fetch(`/api/scans/${encodeURIComponent(scanId)}/handoff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...deviceLicenseService.authHeaders() },
      body: JSON.stringify({
        phone: opts.phone || getKioskPhone() || undefined,
        routine: opts.routine,
        recommendations,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'ثبت برای داروخانه ناموفق بود.');
    return body;
  },

  async progress(phone: string) {
    const res = await fetch(`/api/customers/progress?phone=${encodeURIComponent(phone)}`, {
      headers: { ...deviceLicenseService.authHeaders() },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'خواندن پیشرفت ناموفق بود.');
    return body;
  },
};
