import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';

export default function Auth() {
  const navigate = useNavigate();
  const { verifyOtp } = useAuth();
  const [name, setName] = useState(''); const [contact, setContact] = useState(''); const [otp, setOtp] = useState('');
  const [sent, setSent] = useState(false); const [loading, setLoading] = useState(false); const [error, setError] = useState('');

  const submit = async () => {
    setLoading(true); setError('');
    try {
      await verifyOtp(name || 'کاربر', contact, 'local'); navigate('/onboarding');
    } catch (e) { setError(e instanceof Error ? e.message : 'ارسال کد انجام نشد.'); }
    finally { setLoading(false); }
  };
  const verify = async () => {
    setLoading(true); setError('');
    try { await verifyOtp(name || 'کاربر', contact, otp.trim()); navigate('/onboarding'); }
    catch (e) { setError(e instanceof Error ? e.message : 'کد واردشده صحیح نیست.'); }
    finally { setLoading(false); }
  };

  return <div className="flex flex-col min-h-[calc(100vh-140px)]">
    <TopBar showBack />
    <h1 className="text-[22px] font-extrabold text-sageDeep">ورود امن به پوستا</h1>
    <p className="text-[14.5px] text-stone leading-[1.9] mt-2.5">برای ذخیره تحلیل‌ها، روتین و محصولات شما، با ایمیل یا شماره موبایل وارد شوید.</p>
    <div className="mt-6 flex flex-col gap-3.5">
      <input className="w-full border-[1.5px] border-line rounded-sm px-4 py-3.5 bg-white" value={name} onChange={e=>setName(e.target.value)} placeholder="نام" />
      <input className="w-full border-[1.5px] border-line rounded-sm px-4 py-3.5 bg-white" value={contact} onChange={e=>setContact(e.target.value)} placeholder="ایمیل یا 0912..." disabled={sent} />
      {sent && <input inputMode="numeric" maxLength={6} className="w-full border-[1.5px] border-line rounded-sm px-4 py-3.5 bg-white" value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="کد تأیید" />}
      {error && <div className="bg-[#FBEEE9] text-coral rounded-md p-3 text-sm leading-6">{error}</div>}
    </div>
    <div className="mt-auto pt-6">
      {!sent ? <Button onClick={submit} disabled={loading || !contact.trim()}>{loading ? 'در حال ورود...' : 'ادامه'}</Button>
      : <div className="flex flex-col gap-2.5"><Button onClick={verify} disabled={loading || otp.length < 4}>{loading ? 'در حال ورود...' : 'تأیید و ورود'}</Button><button className="text-sm text-sage font-bold" onClick={()=>setSent(false)}>تغییر شماره/ایمیل</button></div>}
    </div>
  </div>;
}
