const TOKEN_KEY = 'poosta:deviceToken';
const META_KEY = 'poosta:deviceMeta';

export type LicenseStatus = {
  status: string;
  plan?: string;
  plan_id?: string;
  expires_at?: string;
  features?: Record<string, boolean>;
  in_grace?: boolean;
  pharmacy?: { id: string; name: string; status: string } | null;
};

function authHeaders(): HeadersInit {
  const token = getDeviceToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function getDeviceToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function clearDeviceAuth() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(META_KEY);
  } catch { /* */ }
}

export function getStoredLicense(): LicenseStatus | null {
  try {
    const raw = localStorage.getItem(META_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function persistAuth(token: string, license: LicenseStatus) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(META_KEY, JSON.stringify(license));
}

export const deviceLicenseService = {
  async health(): Promise<{ licenseRequired: boolean; ok: boolean }> {
    const res = await fetch('/health');
    const body = await res.json().catch(() => ({}));
    return { ok: Boolean(body.ok), licenseRequired: Boolean(body.licenseRequired) };
  },

  async activate(activationCode: string, appVersion = 'web-0.1.0') {
    const res = await fetch('/api/device/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activation_code: activationCode.trim().toUpperCase(), app_version: appVersion }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || body.code || 'فعال‌سازی ناموفق بود.');
    persistAuth(body.token, body.license);
    return body as { token: string; license: LicenseStatus; device_id: string; pharmacy_id: string };
  },

  async heartbeat(appVersion = 'web-0.1.0') {
    const res = await fetch('/api/device/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ app_version: appVersion }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) clearDeviceAuth();
      throw new Error(body.error || body.code || 'تمدید مجوز ناموفق بود.');
    }
    persistAuth(body.token, body.license);
    return body as { token: string; license: LicenseStatus };
  },

  async status(): Promise<LicenseStatus> {
    const res = await fetch('/api/license/status', { headers: { ...authHeaders() } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) clearDeviceAuth();
      throw new Error(body.error || 'خواندن وضعیت مجوز ناموفق بود.');
    }
    localStorage.setItem(META_KEY, JSON.stringify(body));
    return body;
  },

  authHeaders,
};
