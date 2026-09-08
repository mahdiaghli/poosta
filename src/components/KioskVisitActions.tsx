import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useAppStore } from '@/store/useAppStore';

/** Phone capture, print slip link, and end-of-visit reset for pharmacy kiosk. */
export function KioskVisitActions() {
  const navigate = useNavigate();
  const phone = useAppStore((s) => s.kioskPhone);
  const setKioskPhone = useAppStore((s) => s.setKioskPhone);
  const resetKioskSession = useAppStore((s) => s.resetKioskSession);
  const serverProgress = useAppStore((s) => s.serverProgress);
  const [draft, setDraft] = useState(phone || '');

  const savePhone = () => setKioskPhone(draft.trim());

  const endVisit = () => {
    resetKioskSession();
    navigate('/welcome', { replace: true });
  };

  return (
    <div className="flex flex-col gap-2.5">
      <Card>
        <div className="text-[13px] font-bold text-sageDeep mb-1">شماره موبایل (برای پیشرفت مراجعات بعد)</div>
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="09xxxxxxxxx"
            className="flex-1 border border-line rounded-xl px-3 py-2 text-[14px]"
            dir="ltr"
          />
          <Button variant="secondary" onClick={savePhone}>ثبت</Button>
        </div>
        {serverProgress && (
          <p className="text-[12.5px] text-sageDeep mt-2 leading-[1.8]">
            پیشرفت نسبت به قبل: {serverProgress.prev_overall} → {serverProgress.latest_overall}
            {' '}({serverProgress.overall_diff >= 0 ? '+' : ''}{serverProgress.overall_diff})
          </p>
        )}
      </Card>

      <Button variant="secondary" onClick={() => navigate('/print/kiosk')}>
        چاپ لیست محصولات برای فروشنده
      </Button>

      <Button variant="secondary" onClick={endVisit}>
        پایان نوبت / مشتری بعدی
      </Button>
    </div>
  );
}
