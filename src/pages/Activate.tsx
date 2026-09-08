import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { deviceLicenseService } from '@/services/deviceLicenseService';

export default function Activate() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError('');
    setLoading(true);
    try {
      const out = await deviceLicenseService.activate(code);
      const plan = out.license?.plan || 'basic';
      navigate('/consent', { replace: true, state: { activated: true, plan } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'فعال‌سازی ناموفق بود.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <TopBar showBack eyebrow="مجوز دستگاه" />
      <h1 className="text-[21px] font-extrabold text-sageDeep mb-2">فعال‌سازی پوستا</h1>
      <p className="text-[13px] text-stone leading-[1.8] mb-4">
        کد فعال‌سازی را که از پشتیبانی پوستا دریافت کرده‌اید وارد کنید. بدون مجوز معتبر، اسکن روی این دستگاه انجام نمی‌شود.
      </p>
      <Card className="mb-4">
        <label className="text-[12.5px] font-bold text-sageDeep">کد فعال‌سازی</label>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="PST-XXXX-XXXX"
          className="mt-2 w-full rounded-xl border border-line bg-white px-3 py-3 text-center tracking-widest font-bold text-sageDeep outline-none focus:border-sage"
          autoComplete="off"
        />
        {error && <p className="mt-3 text-[12.5px] text-rose-700">{error}</p>}
      </Card>
      <Button disabled={loading || code.trim().length < 8} onClick={submit}>
        {loading ? 'در حال فعال‌سازی…' : 'فعال‌سازی'}
      </Button>
    </div>
  );
}
