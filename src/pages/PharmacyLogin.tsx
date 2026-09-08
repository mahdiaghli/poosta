import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { pharmacyStaffService } from '@/services/pharmacyStaffService';

export default function PharmacyLogin() {
  const navigate = useNavigate();
  const [code, setCode] = useState('DEMO');
  const [pin, setPin] = useState('1234');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true); setError('');
    try {
      await pharmacyStaffService.login(code, pin);
      navigate('/pharmacy', { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ورود ناموفق');
    } finally { setLoading(false); }
  };

  return (
    <div>
      <TopBar eyebrow="ورود پرسنل" />
      <h1 className="text-[21px] font-extrabold text-sageDeep mb-3">پنل داروخانه پوستا</h1>
      <Card>
        <label className="text-[12px] font-bold">کد داروخانه</label>
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="w-full border border-line rounded-xl px-3 py-3 mt-1 mb-3" />
        <label className="text-[12px] font-bold">رمز ورود</label>
        <input type="password" value={pin} onChange={(e) => setPin(e.target.value)} className="w-full border border-line rounded-xl px-3 py-3 mt-1" />
        {error && <p className="text-rose-700 text-[12.5px] mt-2">{error}</p>}
      </Card>
      <div className="mt-4"><Button disabled={loading} onClick={submit}>{loading ? '…' : 'ورود'}</Button></div>
      <p className="text-[11px] text-stone mt-3">دمو: DEMO / 1234</p>
    </div>
  );
}
