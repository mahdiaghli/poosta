import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getDeviceToken } from '@/services/deviceLicenseService';

const KIOSK_UI_KEY = 'poosta:kioskUi';

export function isKioskUi(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    if (getDeviceToken()) return true;
    if (localStorage.getItem(KIOSK_UI_KEY) === '1') return true;
    if (new URLSearchParams(window.location.search).get('kiosk') === '1') {
      localStorage.setItem(KIOSK_UI_KEY, '1');
      return true;
    }
    if (window.matchMedia('(min-width: 600px)').matches) return true;
  } catch { /* */ }
  return false;
}

/** Licensed tablet, wide viewport, ?kiosk=1, or persisted kiosk flag. */
export function useKioskMode(): boolean {
  const location = useLocation();
  const [kiosk, setKiosk] = useState(isKioskUi);

  useEffect(() => {
    const sync = () => setKiosk(isKioskUi());
    sync();
    const mq = window.matchMedia('(min-width: 600px)');
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [location.pathname, location.search]);

  return kiosk;
}
