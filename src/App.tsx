import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { BottomNav } from '@/components/layout/BottomNav';
import { useAppStore } from '@/store/useAppStore';
import { useEffect } from 'react';
import { notificationService } from '@/services/notificationService';

import Welcome from '@/pages/Welcome';
import Auth from '@/pages/Auth';
import Onboarding from '@/pages/Onboarding';
import Consent from '@/pages/Consent';
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

const MAIN_ROUTES = ['/home', '/scan', '/routine', '/products', '/profile'];

export default function App() {
  const location = useLocation();
  const lastScan = useAppStore((s) => s.lastScan);
  const showNav = MAIN_ROUTES.includes(location.pathname);
  const reminders = useAppStore((s) => s.reminders);
  useEffect(() => { if (typeof window !== 'undefined') notificationService.schedule(reminders); }, [reminders]);

  return (
    <div className="max-w-[480px] mx-auto min-h-screen relative bg-gradient-to-br from-sageMist/40 via-cream to-blushSoft/30">
      <div className="px-[22px] pt-7 pb-[110px]">
        <Routes>
          <Route path="/" element={<Navigate to={lastScan ? '/home' : '/welcome'} replace />} />
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/consent" element={<Consent />} />
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
