import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useAppStore } from '@/store/useAppStore';
import { METRIC_LABELS_FA, type SkinMetricKey } from '@/types';

export default function Progress() {
  const navigate = useNavigate();
  const history = useAppStore((s) => s.scanHistory);
  const comparison = useAppStore((s) => s.lastComparison);
  const [activeIdx, setActiveIdx] = useState(history.length - 1);
  const [slider, setSlider] = useState(50);
  const checkIns = useAppStore((s) => s.checkIns);
  const diaryEntries = useAppStore((s) => s.diaryEntries);

  const first = history[0];
  const after = history[activeIdx] ?? history[history.length - 1];

  const chartPoints = useMemo(() => {
    if (history.length < 2) return '';
    const w = 320, h = 110, pad = 14;
    return history.map((s, i) => {
      const x = pad + (i * (w - 2 * pad)) / (history.length - 1);
      const y = h - pad - (s.overallScore / 100) * (h - 2 * pad);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }, [history]);

  return (
    <div>
      <TopBar eyebrow="روند پیشرفت" />
      <h1 className="text-[22px] font-extrabold text-sageDeep">مسیر بهبود پوست شما</h1>
      <div className="my-4"><Button onClick={() => navigate('/scan')}>تحلیل مجدد پوست</Button></div>

      {comparison && (
        <div className="bg-sageMist border border-sageSoft text-sageDeep rounded-md px-4 py-3.5 text-[13.5px] font-bold mb-4">
          {comparison.diff >= 0 ? '📈' : '📉'} امتیاز پوست شما {Math.abs(comparison.diff)} امتیاز {comparison.diff >= 0 ? 'بهتر' : 'کمتر'} شده است.
        </div>
      )}

      <Card className="mb-4">
        <h2 className="text-[17px] font-bold mb-3.5">تغییر امتیاز پوست</h2>
        {history.length < 2 ? (
          <p className="text-[13px] text-stone">برای مشاهده نمودار، حداقل ۲ اسکن نیاز است</p>
        ) : (
          <svg width="100%" height="120" viewBox="0 0 320 120">
            <path d={chartPoints} fill="none" stroke="#6C8873" strokeWidth={3} strokeLinecap="round" />
            {history.map((s, i) => {
              const w = 320, h = 110, pad = 14;
              const x = pad + (i * (w - 2 * pad)) / (history.length - 1);
              const y = h - pad - (s.overallScore / 100) * (h - 2 * pad);
              return <circle key={i} cx={x} cy={y} r={4} fill="#3C5443" />;
            })}
          </svg>
        )}
      </Card>

      <Card className="mb-4">
        <h2 className="text-[17px] font-bold mb-3.5">قبل / بعد</h2>
        {history.length < 2 ? (
          <p className="text-[14.5px] text-stone mt-0">برای مقایسه قبل/بعد به حداقل ۲ اسکن نیاز دارید.</p>
        ) : (
          <>
            <div className="flex gap-2 mb-3.5 overflow-x-auto no-scrollbar">
              {history.map((s, i) => {
                const days = Math.round((new Date(s.createdAt).getTime() - new Date(first.createdAt).getTime()) / 86400000);
                return (
                  <div key={i} onClick={() => setActiveIdx(i)}
                    className={`whitespace-nowrap rounded-full px-4 py-2 text-[13px] font-semibold border-[1.5px] cursor-pointer ${activeIdx === i ? 'bg-sageDeep border-sageDeep text-white' : 'bg-white border-line'}`}>
                    روز {days}
                  </div>
                );
              })}
            </div>
            <div className="relative h-[220px] rounded-lg overflow-hidden bg-sageMist">
              <div className="absolute inset-0 bg-gradient-to-br from-sageSoft to-blushSoft flex items-center justify-center font-bold text-sageDeep"
                style={after.thumbnailUrl ? { backgroundImage: `url(${after.thumbnailUrl})`, backgroundSize: 'cover' } : {}}>
                {!after.thumbnailUrl && 'آخرین'}
              </div>
              <div className="absolute inset-0 bg-gradient-to-br from-stoneLight to-sageMist flex items-center justify-center font-bold text-stone overflow-hidden"
                style={{ clipPath: `inset(0 ${100 - slider}% 0 0)`, ...(first.thumbnailUrl ? { backgroundImage: `url(${first.thumbnailUrl})`, backgroundSize: 'cover' } : {}) }}>
                {!first.thumbnailUrl && 'روز اول'}
              </div>
              <div className="absolute top-0 bottom-0 w-[3px] bg-white shadow-[0_0_0_2px_rgba(0,0,0,0.08)] pointer-events-none" style={{ right: `${100 - slider}%` }} />
              <input type="range" min={0} max={100} value={slider} onChange={(e) => setSlider(Number(e.target.value))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize" />
            </div>
            <div className="mt-3.5">
              {(['overallScore', ...Object.keys(METRIC_LABELS_FA)] as (SkinMetricKey | 'overallScore')[]).map((k) => {
                const a = k === 'overallScore' ? first.overallScore : first.metrics[k as SkinMetricKey];
                const b = k === 'overallScore' ? after.overallScore : after.metrics[k as SkinMetricKey];
                const label = k === 'overallScore' ? 'امتیاز پوست' : METRIC_LABELS_FA[k as SkinMetricKey];
                const diff = b - a;
                return (
                  <div key={k} className="flex items-center justify-between py-2.5 border-b border-line last:border-none text-[13.5px]">
                    <span>{label}</span>
                    <span className="num">{a} → {b} <span className={diff >= 0 ? 'text-sageDeep font-extrabold' : 'text-coral font-extrabold'}>({diff >= 0 ? '+' : ''}{diff})</span></span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>

      <Card className="mb-4">
        <h2 className="text-[17px] font-bold mb-3.5">پیشرفت روزانه</h2>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-sageMist rounded-md p-3 text-center"><div className="num text-xl font-extrabold text-sageDeep">{checkIns.length}</div><div className="text-[11px] text-stone">چک‌این ثبت‌شده</div></div>
          <div className="bg-sageMist rounded-md p-3 text-center"><div className="num text-xl font-extrabold text-sageDeep">{diaryEntries.length}</div><div className="text-[11px] text-stone">یادداشت پوستی</div></div>
        </div>
        <div className="flex gap-2 mt-3"><button onClick={()=>navigate('/check-in')} className="flex-1 border border-line rounded-full py-2 text-xs font-bold">چک‌این امروز</button><button onClick={()=>navigate('/diary')} className="flex-1 border border-line rounded-full py-2 text-xs font-bold">دفترچه پوست</button></div>
      </Card>

      <Card>
        <h2 className="text-[17px] font-bold mb-3.5">تاریخچه تحلیل‌ها</h2>
        {history.length === 0 && <p className="text-[14.5px] text-stone mt-0">هنوز تحلیلی ثبت نشده است.</p>}
        {history.slice().reverse().map((s, i) => (
          <div key={i} className="flex items-center justify-between py-3 border-b border-line last:border-none text-[13.5px]">
            <span>{new Date(s.createdAt).toLocaleDateString('fa-IR')}</span>
            <span className="num font-extrabold text-sageDeep">{s.overallScore}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}
