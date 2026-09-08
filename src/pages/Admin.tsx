import { useEffect, useState } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

const KEY_STORE = 'poosta:adminKey';

export default function Admin() {
  const [adminKey, setAdminKey] = useState(() => localStorage.getItem(KEY_STORE) || '');
  const [pharmacies, setPharmacies] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [selectedPharmacy, setSelectedPharmacy] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', city: '', code: '', pin: '1234', plan: 'basic' });
  const [renewYears, setRenewYears] = useState(1);

  const headers = () => ({
    'Content-Type': 'application/json',
    'X-Poosta-Admin-Key': adminKey,
  });

  const saveKey = () => localStorage.setItem(KEY_STORE, adminKey);

  const loadPharmacies = async () => {
    saveKey();
    const res = await fetch('/api/admin/pharmacies', { headers: headers() });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'خطا');
    setPharmacies(body.pharmacies || []);
  };

  const createPharmacy = async () => {
    const res = await fetch('/api/admin/pharmacies', {
      method: 'POST', headers: headers(), body: JSON.stringify(form),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'ایجاد ناموفق');
    alert(`ساخته شد.\nActivation: ${body.device_activation_code}\nCode: ${body.pharmacy.code}`);
    await loadPharmacies();
  };

  const loadDevices = async (pharmacyId: string) => {
    setSelectedPharmacy(pharmacyId);
    const res = await fetch(`/api/admin/pharmacies/${pharmacyId}/devices`, { headers: headers() });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'خطا');
    setDevices(body.devices || []);
  };

  const revoke = async (deviceId: string) => {
    const res = await fetch('/api/admin/devices/revoke', {
      method: 'POST', headers: headers(), body: JSON.stringify({ device_id: deviceId }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'لغو ناموفق');
    await loadDevices(selectedPharmacy);
  };

  const renew = async (pharmacyId: string) => {
    const res = await fetch('/api/admin/subscriptions/renew', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ pharmacy_id: pharmacyId, plan: 'basic', years: renewYears }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'تمدید ناموفق');
    alert(`تمدید تا ${body.expires_at}`);
    await loadPharmacies();
  };

  useEffect(() => {
    if (adminKey) loadPharmacies().catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <TopBar eyebrow="ادمین پوستا" />
      <h1 className="text-[21px] font-extrabold text-sageDeep mb-3">مدیریت لایسنس</h1>
      <Card className="mb-3">
        <label className="text-[12px] font-bold">POOSTA_ADMIN_KEY</label>
        <input value={adminKey} onChange={(e) => setAdminKey(e.target.value)} className="w-full border border-line rounded-xl px-3 py-2 mt-1" type="password" />
        <div className="mt-2"><Button onClick={() => loadPharmacies().catch((e) => setError(e.message))}>بارگذاری</Button></div>
      </Card>
      {error && <p className="text-rose-700 text-[12.5px] mb-2">{error}</p>}

      <Card className="mb-3">
        <h2 className="font-bold mb-2">داروخانه جدید</h2>
        <input className="w-full border border-line rounded-xl px-3 py-2 mb-2" placeholder="نام" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="w-full border border-line rounded-xl px-3 py-2 mb-2" placeholder="شهر" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
        <input className="w-full border border-line rounded-xl px-3 py-2 mb-2" placeholder="کد ورود پرسنل" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
        <input className="w-full border border-line rounded-xl px-3 py-2 mb-2" placeholder="PIN" value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value })} />
        <Button onClick={() => createPharmacy().catch((e) => setError(e.message))}>ایجاد + دستگاه</Button>
      </Card>

      <Card className="mb-3">
        <h2 className="font-bold mb-2">داروخانه‌ها</h2>
        {pharmacies.map((p) => (
          <div key={p.id} className="border-b border-line py-2 text-[12.5px]">
            <div className="font-bold">{p.name} ({p.code})</div>
            <div className="text-stone">انقضا: {p.expires_at ? new Date(p.expires_at).toLocaleDateString('fa-IR') : '—'} · دستگاه فعال: {p.active_devices}</div>
            <div className="flex gap-2 mt-1">
              <button className="underline text-sageDeep" onClick={() => loadDevices(p.id).catch((e) => setError(e.message))}>دستگاه‌ها</button>
              <button className="underline text-sageDeep" onClick={() => renew(p.id).catch((e) => setError(e.message))}>تمدید {renewYears} ساله</button>
            </div>
          </div>
        ))}
        <div className="mt-2 flex items-center gap-2 text-[12px]">
          <span>سال تمدید:</span>
          <input type="number" min={1} value={renewYears} onChange={(e) => setRenewYears(Number(e.target.value))} className="w-16 border border-line rounded px-2 py-1" />
        </div>
      </Card>

      {devices.length > 0 && (
        <Card>
          <h2 className="font-bold mb-2">دستگاه‌ها</h2>
          {devices.map((d) => (
            <div key={d.id} className="text-[12.5px] py-2 border-b border-line flex justify-between gap-2">
              <div>
                <div className="font-bold">{d.device_code} · {d.status}</div>
                <div className="text-stone">فعال‌سازی: {d.activation_code}</div>
              </div>
              {d.status !== 'revoked' && (
                <button className="text-rose-700 text-xs font-bold" onClick={() => revoke(d.id).catch((e) => setError(e.message))}>لغو</button>
              )}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
