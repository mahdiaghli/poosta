import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { ScoreRing } from '@/components/ui/ScoreRing';
import { useAppStore } from '@/store/useAppStore';
import { useRoutineTracker } from '@/hooks/useRoutine';
import { weatherService } from '@/services/weatherService';
import type { WeatherInfo } from '@/types';

const TOOLS: [string, string, string][] = [
  ['🤖', 'مربی هوشمند پوست', '/coach'],
  ['🧺', 'محصولات من', '/my-products'],
  ['🔬', 'اسکنر مواد تشکیل‌دهنده', '/ingredients'],
  ['🔒', 'حریم خصوصی', '/privacy'],
  ['✅', 'چک‌این امروز', '/check-in'],
  ['📔', 'دفترچه پوست', '/diary'],
  ['📅', 'برنامه هفتگی', '/routine/weekly'],
];

export default function Home() {
  const navigate = useNavigate();
  const user = useAppStore((s) => s.user);
  const lastScan = useAppStore((s) => s.lastScan);
  const routine = useAppStore((s) => s.routine);
  const products = useAppStore((s) => s.products);
  const { todayCompletion, streaks } = useRoutineTracker();
  const [weather, setWeather] = useState<WeatherInfo | null>(null);

  useEffect(() => { weatherService.getCurrent().then(setWeather); }, []);

  const name = user?.name ?? 'مهمان';

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2 font-extrabold text-lg text-sageDeep">
          <span className="w-2.5 h-2.5 rounded-full bg-blush" /> پوستا
        </div>
        <div className="w-[38px] h-[38px] rounded-full bg-blushSoft text-coral flex items-center justify-center font-bold text-sm">{name[0]}</div>
      </div>

      <div className="bg-gradient-to-br from-sageDeep to-sage rounded-lg p-5.5 text-white flex items-center gap-4.5 shadow-card">
        <div className="relative w-[76px] h-[76px] flex-none">
          <ScoreRing size={76} strokeWidth={7} score={lastScan?.overallScore ?? 0} trackColor="rgba(255,255,255,0.25)" fillColor="#fff" />
          <div className="absolute inset-0 flex items-center justify-center font-bold text-[19px]">{lastScan ? lastScan.overallScore : '--'}</div>
        </div>
        <div>
          <div className="text-xs opacity-85">سلام {name.split(' ')[0]} 👋</div>
          <div className="font-extrabold text-base mt-1">{lastScan ? 'وضعیت پوست شما امروز خوب است' : 'هنوز پوستتان را تحلیل نکرده‌اید'}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 my-5">
        <div onClick={() => navigate('/scan')} className="bg-white border border-line rounded-md p-4 text-center cursor-pointer">
          <div className="text-[22px] mb-1.5">📷</div><div className="text-[13px] font-bold">اسکن جدید پوست</div>
        </div>
        <div onClick={() => navigate('/progress')} className="bg-white border border-line rounded-md p-4 text-center cursor-pointer">
          <div className="text-[22px] mb-1.5">📈</div><div className="text-[13px] font-bold">مشاهده پیشرفت</div>
        </div>
      </div>

      {weather && (
        <div className="flex items-center gap-3.5 bg-white border border-line rounded-md px-4 py-3.5 mb-4">
          <div className="text-2xl">{weather.uv >= 6 ? '☀️' : '⛅'}</div>
          <div className="text-[12.5px] text-stone leading-[1.7]">
            <b className="text-sageDeep">{weather.temp}°  ·  رطوبت {weather.humidity}٪  ·  UV {weather.uv}</b><br />
            {weatherService.advice(weather)}
          </div>
        </div>
      )}

      <div className="flex gap-2.5 mb-4">
        <div className="flex-1 bg-white border border-line rounded-md p-3.5 text-center">
          <div className="num text-xl font-extrabold text-sageDeep">{streaks.current}</div>
          <div className="text-[11.5px] text-stone mt-0.5">🔥 روز متوالی</div>
        </div>
        <div className="flex-1 bg-white border border-line rounded-md p-3.5 text-center">
          <div className="num text-xl font-extrabold text-sageDeep">{todayCompletion}٪</div>
          <div className="text-[11.5px] text-stone mt-0.5">تکمیل روتین امروز</div>
        </div>
      </div>

      <Card className="mb-3.5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[17px] font-bold">روتین امروز</h2>
          <button onClick={() => navigate('/routine')} className="text-xs font-semibold text-sage">مشاهده همه</button>
        </div>
        <p className="text-[14.5px] text-stone leading-[1.9] mt-0">
          {routine ? <>مرحله بعدی صبح: <b>{routine.morning[0]?.name}</b> — {routine.morning[0]?.productName}</> : 'با اسکن پوستتان، روتین اختصاصی خودتان را بسازید.'}
        </p>
      </Card>

      <Card className="mb-3.5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[17px] font-bold">پیشنهاد امروز</h2>
          <button onClick={() => navigate('/products')} className="text-xs font-semibold text-sage">مشاهده همه</button>
        </div>
        <p className="text-[14.5px] text-stone leading-[1.9] mt-0">
          {products[0] ? <><b>{products[0].name}</b> با {products[0].compatibility.score}٪ تطابق با پوست شما</> : 'پس از تحلیل پوست، پیشنهاد محصول اینجا نمایش داده می‌شود.'}
        </p>
      </Card>

      <h2 className="text-[17px] font-bold mt-1.5 mb-3">ابزارهای بیشتر</h2>
      <div className="grid grid-cols-2 gap-3">
        {TOOLS.map(([icon, label, path]) => (
          <div key={path} onClick={() => navigate(path)} className="bg-white border border-line rounded-md p-4 text-center cursor-pointer">
            <div className="text-[22px] mb-1.5">{icon}</div><div className="text-[13px] font-bold">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
