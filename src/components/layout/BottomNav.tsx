import { NavLink, useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import { useKioskMode } from '@/hooks/useKioskMode';
import { SHELL_WIDTH } from '@/lib/shell';

const CONSUMER = [
  { to: '/home', icon: '🏠', label: 'خانه' },
  { to: '/scan', icon: '📷', label: 'اسکن' },
  { to: '/routine', icon: '🗓️', label: 'روتین' },
  { to: '/products', icon: '🛍️', label: 'محصولات' },
  { to: '/profile', icon: '👤', label: 'پروفایل' },
];

const KIOSK = [
  { to: '/scan', icon: '📷', label: 'اسکن' },
  { to: '/result', icon: '📊', label: 'نتیجه' },
  { to: '/routine', icon: '🗓️', label: 'روتین' },
  { to: '/products', icon: '🛍️', label: 'محصولات' },
];

export function BottomNav() {
  const kiosk = useKioskMode();
  const navigate = useNavigate();
  const lastScan = useAppStore((s) => s.lastScan);
  const resetKioskSession = useAppStore((s) => s.resetKioskSession);
  const items = kiosk ? KIOSK : CONSUMER;

  const endVisit = () => {
    resetKioskSession();
    navigate('/welcome', { replace: true });
  };

  return (
    <nav className={`${SHELL_WIDTH} fixed bottom-0 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-md border-t border-line flex justify-around items-stretch px-1.5 min-[600px]:px-4 pt-2 pb-[calc(10px+env(safe-area-inset-bottom))] z-50`}>
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={(e) => {
            if (item.to === '/result' && !lastScan) {
              e.preventDefault();
              navigate('/scan');
            }
          }}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-1 min-w-14 min-h-12 min-[600px]:min-h-14 text-[11px] min-[600px]:text-[13px] font-bold ${isActive ? 'text-sageDeep' : 'text-stoneLight'}`
          }
        >
          <span className="text-[19px] min-[600px]:text-[22px]">{item.icon}</span>
          {item.label}
        </NavLink>
      ))}
      {kiosk && (
        <button
          type="button"
          onClick={endVisit}
          className="flex flex-col items-center justify-center gap-1 min-w-14 min-h-12 min-[600px]:min-h-14 text-[11px] min-[600px]:text-[13px] font-bold text-coral"
        >
          <span className="text-[19px] min-[600px]:text-[22px]">⏻</span>
          پایان
        </button>
      )}
    </nav>
  );
}
