import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';

const IDLE_MS = 3 * 60 * 1000;

/** After 3 minutes without touch, clear the visit so the next customer cannot see scores. */
export function useKioskIdle(enabled: boolean) {
  const navigate = useNavigate();
  const resetKioskSession = useAppStore((s) => s.resetKioskSession);

  useEffect(() => {
    if (!enabled) return;
    let timer = 0;
    const arm = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        resetKioskSession();
        navigate('/welcome', { replace: true });
      }, IDLE_MS);
    };
    arm();
    const opts = { passive: true } as const;
    const events = ['pointerdown', 'keydown', 'touchstart'] as const;
    events.forEach((e) => window.addEventListener(e, arm, opts));
    return () => {
      window.clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, arm));
    };
  }, [enabled, navigate, resetKioskSession]);
}
