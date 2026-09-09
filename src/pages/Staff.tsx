import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { getStaffToken, pharmacyStaffService } from '@/services/pharmacyStaffService';
import { getDeviceToken, getStoredLicense } from '@/services/deviceLicenseService';
import { useAppStore } from '@/store/useAppStore';

export default function Staff() {
  const navigate = useNavigate();
  const lastScan = useAppStore((s) => s.lastScan);
  const kioskPhone = useAppStore((s) => s.kioskPhone);
  const resetKioskSession = useAppStore((s) => s.resetKioskSession);
  const [loggedIn, setLoggedIn] = useState(() => Boolean(getStaffToken()));
  const [code, setCode] = useState('DEMO');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [todayCount, setTodayCount] = useState<number | null>(null);
  const license = getStoredLicense();
  const meta = pharmacyStaffService.getPharmacyMeta();
  const deviceOn = Boolean(getDeviceToken());

  useEffect(() => {
    if (!loggedIn) return;
    pharmacyStaffService.todayScans().then((list) => setTodayCount(list.length)).catch(() => setTodayCount(null));
  }, [loggedIn]);

  const login = async () => {
    setLoading(true);
    setError('');
    try {
      await pharmacyStaffService.login(code, pin);
      setLoggedIn(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ورود ناموفق بود.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <TopBar showBack eyebrow="ورود کارکنان" />
      <h1 className="text-[22px] font-extrabold text-sageDeep mb-2">پنل کارکنان داروخانه</h1>
      <p className="text-[14px] text-stone leading-[1.8] mb-4">
        این صفحه برای مشتری نیست. اسکن‌های امروز، موجودی، چاپ و مجوز دستگاه را از اینجا مدیریت کنید.
      </p>

      {!loggedIn ? (
        <Card className="mb-4">
          <label className="text-[13px] font-bold text-sageDeep">کد داروخانه</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="w-full border border-line rounded-xl px-3 min-h-12 mt-1 mb-3"
          />
          <label className="text-[13px] font-bold text-sageDeep">رمز ورود</label>
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="w-full border border-line rounded-xl px-3 min-h-12 mt-1"
            inputMode="numeric"
          />
          {error && <p className="text-coral text-[13px] mt-2">{error}</p>}
          <div className="mt-4">
            <Button disabled={loading || !pin} onClick={login}>{loading ? '…' : 'ورود به پنل'}</Button>
          </div>
          <p className="text-[12px] text-stone mt-2">دمو: DEMO / 1234</p>
        </Card>
      ) : (
        <Card className="mb-4">
          <div className="font-bold text-sageDeep">{meta?.name || 'داروخانه'}</div>
          <p className="text-[13px] text-stone mt-1">
            اسکن امروز: {todayCount == null ? '—' : todayCount}
            {kioskPhone ? ` · آخرین موبایل کیوسک: ${kioskPhone}` : ''}
          </p>
        </Card>
      )}

      <div className="flex flex-col gap-2.5">
        {loggedIn && (
          <>
            <Button onClick={() => navigate('/pharmacy')}>اسکن‌های امروز و جزئیات مشتری</Button>
            <Button variant="secondary" onClick={() => navigate('/pharmacy')}>موجودی و قیمت محصولات</Button>
          </>
        )}
        <Button variant="secondary" onClick={() => navigate('/print/kiosk')} disabled={!lastScan}>
          چاپ لیست همین نوبت برای فروشنده
        </Button>
        <Button variant="secondary" onClick={() => navigate('/activate')}>
          {deviceOn ? `مجوز دستگاه: ${license?.plan || 'فعال'}` : 'فعال‌سازی این تبلت'}
        </Button>
        <Button variant="secondary" onClick={() => navigate('/admin')}>تنظیمات ادمین</Button>
        <Button
          variant="secondary"
          onClick={() => {
            resetKioskSession();
            navigate('/scan', { replace: true });
          }}
        >
          بازگشت به کیوسک مشتری
        </Button>
      </div>
    </div>
  );
}
