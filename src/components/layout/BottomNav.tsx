import { NavLink } from 'react-router-dom';

const ITEMS = [
  { to: '/home', icon: '🏠', label: 'خانه' },
  { to: '/scan', icon: '📷', label: 'اسکن' },
  { to: '/routine', icon: '🗓️', label: 'روتین' },
  { to: '/products', icon: '🛍️', label: 'محصولات' },
  { to: '/profile', icon: '👤', label: 'پروفایل' },
];

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white/90 backdrop-blur-md border-t border-line flex justify-around px-1.5 pt-2.5 pb-[calc(10px+env(safe-area-inset-bottom))] z-50">
      {ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 w-14 text-[11px] font-bold ${isActive ? 'text-sageDeep' : 'text-stoneLight'}`
          }
        >
          <span className="text-[19px]">{item.icon}</span>
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
