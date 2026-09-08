const STAFF_KEY = 'poosta:staffToken';
const STAFF_META = 'poosta:staffMeta';

export function getStaffToken() {
  try { return localStorage.getItem(STAFF_KEY); } catch { return null; }
}

export function clearStaffAuth() {
  try {
    localStorage.removeItem(STAFF_KEY);
    localStorage.removeItem(STAFF_META);
  } catch { /* */ }
}

function staffHeaders(): HeadersInit {
  const t = getStaffToken();
  return t ? { 'X-Poosta-Staff-Token': t } : {};
}

export const pharmacyStaffService = {
  async login(code: string, pin: string) {
    const res = await fetch('/api/pharmacy/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, pin }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'ورود ناموفق بود.');
    localStorage.setItem(STAFF_KEY, body.token);
    localStorage.setItem(STAFF_META, JSON.stringify(body.pharmacy));
    return body;
  },

  getPharmacyMeta() {
    try { return JSON.parse(localStorage.getItem(STAFF_META) || 'null'); } catch { return null; }
  },

  async todayScans(since?: string) {
    const q = since ? `?since=${encodeURIComponent(since)}` : '';
    const res = await fetch(`/api/pharmacy/scans/today${q}`, { headers: { ...staffHeaders() } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'خواندن اسکن‌ها ناموفق بود.');
    return body.scans as any[];
  },

  async scanDetail(scanId: string) {
    const res = await fetch(`/api/pharmacy/scans/${encodeURIComponent(scanId)}`, { headers: { ...staffHeaders() } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'اسکن پیدا نشد.');
    return body;
  },

  async customerProgress(phone: string) {
    const res = await fetch(`/api/pharmacy/customers/progress?phone=${encodeURIComponent(phone)}`, {
      headers: { ...staffHeaders() },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'پیشرفت پیدا نشد.');
    return body;
  },

  async listProducts() {
    const res = await fetch('/api/pharmacy/products', { headers: { ...staffHeaders() } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'موجودی خوانده نشد.');
    return body.products as any[];
  },

  async upsertProduct(row: Record<string, unknown>) {
    const res = await fetch('/api/pharmacy/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...staffHeaders() },
      body: JSON.stringify(row),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'ذخیره موجودی ناموفق بود.');
    return body;
  },
};
