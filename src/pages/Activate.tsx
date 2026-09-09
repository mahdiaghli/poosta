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
      navigate('/welcome', { replace: true, state: { activated: true, plan } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'فعال‌سازی ناموفق بود.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <TopBar eyebrow="راه‌اندازی اولیه" />
      <h1 className="text-[21px] min-[600px]:text-[26px] font-extrabold text-sageDeep mb-2">فعال‌سازی تبلت داروخانه</h1>
      <p className="text-[13px] text-stone leading-[1.8] mb-4">
        برای اولین استفاده، کد مجوز داروخانه را وارد کنید. پس از فعال‌سازی، همه بخش‌های پوستا روی این تبلت در دسترس قرار می‌گیرند.
      </p>
      <Card className="mb-4">
        <label className="text-[12.5px] min-[600px]:text-sm font-bold text-sageDeep">کد مجوز داروخانه</label>
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
