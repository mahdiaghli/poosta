import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

interface Props { eyebrow?: string; showBack?: boolean; right?: ReactNode; }

export function TopBar({ eyebrow, showBack, right }: Props) {
  const navigate = useNavigate();
  return (
    <div className="flex items-center justify-between mb-5">
      {showBack ? (
        <button onClick={() => navigate(-1)} className="w-9 h-9 min-[600px]:w-12 min-[600px]:h-12 rounded-full bg-white border border-line flex items-center justify-center text-lg">←</button>
      ) : <div className="w-9 min-[600px]:w-12" />}
      {eyebrow && (
        <span className="text-xs min-[600px]:text-sm font-semibold bg-sageMist text-sage rounded-full px-3.5 py-1.5">{eyebrow}</span>
      )}
      {right ?? <div className="w-9 min-[600px]:w-12" />}
    </div>
  );
}
