import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/layout/BottomNav';
import { useAppStore } from '@/store/useAppStore';
import { useEffect, useState } from 'react';
import { notificationService } from '@/services/notificationService';

import Welcome from '@/pages/Welcome';
import Auth from '@/pages/Auth';
import Onboarding from '@/pages/Onboarding';
import Activate from '@/pages/Activate';
import Scan from '@/pages/Scan';
import Analyzing from '@/pages/Analyzing';
import Result from '@/pages/Result';
import Routine from '@/pages/Routine';
import Products from '@/pages/Products';
import Progress from '@/pages/Progress';
import Home from '@/pages/Home';
import Profile from '@/pages/Profile';
import MyProducts from '@/pages/MyProducts';
import Barcode from '@/pages/Barcode';
import IngredientScanner from '@/pages/IngredientScanner';
import Coach from '@/pages/Coach';
import Privacy from '@/pages/Privacy';
import ProductDetail from '@/pages/ProductDetail';
import WeeklyRoutine from '@/pages/WeeklyRoutine';
import PatchTest from '@/pages/PatchTest';
import DailyCheckIn from '@/pages/DailyCheckIn';
import SkinDiary from '@/pages/SkinDiary';
import SharedRoutine from '@/pages/SharedRoutine';
import PharmacyLogin from '@/pages/PharmacyLogin';
import PharmacyDashboard from '@/pages/PharmacyDashboard';
import PrintScanSlip from '@/pages/PrintScanSlip';
import PrintKioskSlip from '@/pages/PrintKioskSlip';
import Admin from '@/pages/Admin';
import Staff from '@/pages/Staff';
import { deviceLicenseService, getDeviceToken } from '@/services/deviceLicenseService';
import { useKioskMode } from '@/hooks/useKioskMode';
import { useKioskIdle } from '@/hooks/useKioskIdle';
import { SHELL_WIDTH } from '@/lib/shell';

const MAIN_ROUTES = ['/home', '/scan', '/routine', '/products', '/profile'];
const KIOSK_NAV_PREFIXES = ['/scan', '/result', '/routine', '/products'];

function pathHasNav(pathname: string, kiosk: boolean) {
  if (kiosk) return KIOSK_NAV_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  return MAIN_ROUTES.includes(pathname) || pathname.startsWith('/routine/');
}
export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const lastScan = useAppStore((s) => s.lastScan);
  const kiosk = useKioskMode();
  useKioskIdle(kiosk);
  const showNav = pathHasNav(location.pathname, kiosk);
  const padBottom = kiosk && location.pathname === '/result'
    ? 'pb-[240px] min-[600px]:pb-[260px]'
    : showNav
      ? 'pb-[110px] min-[600px]:pb-[128px]'
      : 'pb-8';
  const reminders = useAppStore((s) => s.reminders);
  const [licenseGate, setLicenseGate] = useState<'checking' | 'ready' | 'locked'>('checking');

  useEffect(() => {
    if (kiosk && location.pathname === '/home') navigate('/scan', { replace: true });
  }, [kiosk, location.pathname, navigate]);
  useEffect(() => { if (typeof window !== 'undefined') notificationService.schedule(reminders); }, [reminders]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const health = await deviceLicenseService.health();
        if (cancelled) return;
        if (!health.licenseRequired) {
          setLicenseGate('ready');
          return;
        }
        if (!getDeviceToken()) {
          setLicenseGate('locked');
          if (location.pathname !== '/activate') navigate('/activate', { replace: true });
          return;
        }
        try {
          await deviceLicenseService.heartbeat();
          if (!cancelled) setLicenseGate('ready');
        } catch {
          if (!cancelled) {
            setLicenseGate('locked');
            navigate('/activate', { replace: true });
          }
        }
      } catch {
        if (!cancelled) {
          /* Local UI development can run without the API; production kiosks fail closed. */
          if (import.meta.env.DEV) setLicenseGate('ready');
          else {
            setLicenseGate('locked');
            navigate('/activate', { replace: true });
          }
        }
      }
    })();
    return () => { cancelled = true; };
  }, [location.pathname, navigate]);

  if (licenseGate === 'checking') {
    return (
      <div className={`${SHELL_WIDTH} mx-auto min-h-[100dvh] bg-gradient-to-br from-sageMist/40 via-cream to-blushSoft/30 flex items-center justify-center`}>
        <div className="text-center text-sageDeep">
          <div className="mx-auto mb-4 h-11 w-11 rounded-full border-4 border-sageMist border-t-sageDeep animate-spin" />
          <p className="text-sm font-bold">در حال بررسی مجوز دستگاه…</p>
        </div>
      </div>
    );
  }

  if (licenseGate === 'locked') {
    return (
      <div className={`${SHELL_WIDTH} mx-auto min-h-[100dvh] relative bg-gradient-to-br from-sageMist/40 via-cream to-blushSoft/30`}>
        <div className="px-[22px] min-[600px]:px-8 min-[1100px]:px-10 pt-7 pb-8"><Activate /></div>
      </div>
    );
  }

  return (
    <div className={`${SHELL_WIDTH} mx-auto min-h-[100dvh] relative bg-gradient-to-br from-sageMist/40 via-cream to-blushSoft/30`}>
      <div className={`px-[22px] min-[600px]:px-8 min-[1100px]:px-10 pt-7 ${padBottom}`}>
        <Routes>
          <Route path="/" element={<Navigate to={lastScan ? (kiosk ? '/result' : '/home') : '/welcome'} replace />} />
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/activate" element={<Activate />} />
          <Route path="/r/:token" element={<SharedRoutine />} />
          <Route path="/pharmacy/login" element={<PharmacyLogin />} />
          <Route path="/pharmacy" element={<PharmacyDashboard />} />
          <Route path="/print/scan/:scanId" element={<PrintScanSlip />} />
          <Route path="/print/kiosk" element={<PrintKioskSlip />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/consent" element={<Navigate to="/scan" replace />} />
          <Route path="/staff" element={<Staff />} />
          <Route path="/scan" element={<Scan />} />
          <Route path="/analyzing" element={<Analyzing />} />
          <Route path="/result" element={<Result />} />
          <Route path="/routine" element={<Routine />} />
          <Route path="/products" element={<Products />} />
          <Route path="/products/:id" element={<ProductDetail />} />
          <Route path="/routine/weekly" element={<WeeklyRoutine />} />
          <Route path="/patch-test" element={<PatchTest />} />
          <Route path="/check-in" element={<DailyCheckIn />} />
          <Route path="/diary" element={<SkinDiary />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/home" element={<Home />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/my-products" element={<MyProducts />} />
          <Route path="/barcode" element={<Barcode />} />
          <Route path="/ingredients" element={<IngredientScanner />} />
          <Route path="/coach" element={<Coach />} />
          <Route path="/privacy" element={<Privacy />} />
        </Routes>
      </div>
      {showNav && <BottomNav />}
    </div>
  );
}
