import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';

const PHRASES = ['در حال تحلیل پوست شما...', 'در حال بررسی بافت پوست...', 'در حال شناسایی نقاط حساس...', 'در حال آماده‌سازی روتین شخصی...'];

export default function Analyzing() {
  const navigate = useNavigate();
  const location = useLocation();
  const runScan = useAppStore((s) => s.runScan);
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const state = location.state as { imageDataUrl?: string; thumb?: string } | null;
    if (!state?.imageDataUrl) { navigate('/scan', { replace: true }); return; }

    const interval = setInterval(() => setPhraseIdx((i) => (i + 1) % PHRASES.length), 1300);
    runScan(state.imageDataUrl, state.thumb).then(() => {
      clearInterval(interval);
      navigate('/result', { replace: true });
    }).catch((err) => {
      clearInterval(interval);
      setError(err instanceof Error ? err.message : 'تحلیل پوست انجام نشد.');
    });
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (<div className="flex flex-col items-center justify-center text-center gap-5 min-h-[calc(100vh-140px)]">
      <div className="text-4xl">⚠️</div><h1 className="text-xl font-bold text-sageDeep">تحلیل انجام نشد</h1>
      <p className="text-sm text-stone leading-7 max-w-sm">{error}</p>
      <button onClick={() => navigate('/scan', { replace: true })} className="rounded-xl px-5 py-3 bg-sageDeep text-white font-bold">تلاش دوباره</button>
    </div>);
  }

  return (
    <div className="flex flex-col items-center justify-center text-center gap-6 min-h-[calc(100vh-140px)]">
      <div className="w-[140px] h-[140px] rounded-full border-[3px] border-sageSoft relative flex items-center justify-center">
        <div className="absolute -inset-2.5 rounded-full border-[3px] border-sageMist animate-spin" style={{ animationDuration: '2.2s' }} />
        <span className="text-4xl text-sageDeep">✦</span>
      </div>
      <div className="text-[15px] font-semibold text-sageDeep min-h-[22px]">{PHRASES[phraseIdx]}</div>
      <p className="text-[14.5px] text-stone">لطفاً چند لحظه صبر کنید</p>
    </div>
  );
}
