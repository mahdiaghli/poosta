import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/layout/TopBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAppStore } from '@/store/useAppStore';
import { useRoutineTracker } from '@/hooks/useRoutine';
import type { RoutinePeriod, RoutineVariant, Budget } from '@/types';
import { SendRoutineSms } from '@/components/SendRoutineSms';

const VARIANTS: [RoutineVariant, string][] = [['best', 'بهترین روتین'], ['budget', 'مقرون‌به‌صرفه'], ['minimal', 'حداقلی']];
const BUDGETS: [Budget, string][] = [['under1m', 'زیر ۱M'], ['1to2m', '۱ تا ۲M'], ['2to5m', '۲ تا ۵M'], ['5plus', 'بالای ۵M']];
const IMPORTANCE_LABEL = { high: 'اهمیت بالا', mid: 'اهمیت متوسط', low: 'اهمیت کم' } as const;

export default function Routine() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<RoutinePeriod>('morning');
  const { routine, today, todayCompletion, streaks, toggleStep } = useRoutineTracker();
  const routineVariant = useAppStore((s) => s.routineVariant);
  const budget = useAppStore((s) => s.budget);
  const useOnlyMyProducts = useAppStore((s) => s.useOnlyMyProducts);
  const setRoutineOptions = useAppStore((s) => s.setRoutineOptions);

  return (
    <div>
      <TopBar eyebrow="روتین شخصی‌سازی‌شده" />
      <h1 className="text-[22px] font-extrabold text-sageDeep">روتین روزانه شما</h1><button onClick={() => navigate("/routine/weekly")} className="mt-2 text-sm font-bold text-sageDeep underline">مشاهده برنامه هفتگی →</button>

      <div className="flex gap-2.5 mt-4">
        {[['🔥 روز متوالی', streaks.current], ['بهترین رکورد', streaks.longest], ['تکمیل امروز', `${todayCompletion}٪`]].map(([label, val]) => (
          <div key={label as string} className="flex-1 bg-white border border-line rounded-md p-3.5 text-center">
            <div className="num text-xl font-extrabold text-sageDeep">{val}</div>
            <div className="text-[11.5px] text-stone mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      <div className="flex bg-sageMist rounded-full p-1 mt-4">
        {VARIANTS.map(([v, label]) => (
          <div key={v} onClick={() => setRoutineOptions({ variant: v })}
            className={`flex-1 text-center py-2.5 rounded-full text-[12.5px] font-bold cursor-pointer ${routineVariant === v ? 'bg-sageDeep text-white' : 'text-sageDeep'}`}>
            {label}
          </div>
        ))}
      </div>
      <div className="flex bg-sageMist rounded-full p-1 mt-2.5">
        {BUDGETS.map(([b, label]) => (
          <div key={b} onClick={() => setRoutineOptions({ budget: b })}
            className={`flex-1 text-center py-2.5 rounded-full text-[12.5px] font-bold cursor-pointer ${budget === b ? 'bg-sageDeep text-white' : 'text-sageDeep'}`}>
            {label}
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-3.5 mb-4">
        <div onClick={() => setRoutineOptions({ useOnlyMyProducts: false })}
          className={`flex-1 text-center rounded-full px-4 py-2.5 text-[13.5px] font-semibold cursor-pointer border-[1.5px] ${!useOnlyMyProducts ? 'bg-sageDeep border-sageDeep text-white' : 'bg-white border-line'}`}>
          پیشنهاد بهتر
        </div>
        <div onClick={() => setRoutineOptions({ useOnlyMyProducts: true })}
          className={`flex-1 text-center rounded-full px-4 py-2.5 text-[13.5px] font-semibold cursor-pointer border-[1.5px] ${useOnlyMyProducts ? 'bg-sageDeep border-sageDeep text-white' : 'bg-white border-line'}`}>
          فقط محصولات من
        </div>
      </div>

      {routine?.conflicts.map((c, i) => (
        <div key={i} className="bg-[#FBEEE9] border border-[#F0CFC3] text-coral rounded-md px-4 py-3.5 text-[13px] leading-[1.9] mb-4">
          <b className="block mb-1">⚠ احتمال تداخل ترکیبات فعال</b>{c.message}
        </div>
      ))}

      <div className="flex gap-2 mb-4">
        {(['morning', 'night'] as RoutinePeriod[]).map((p) => (
          <div key={p} onClick={() => setTab(p)}
            className={`flex-1 text-center py-2.5 rounded-full font-bold text-[13.5px] cursor-pointer border-[1.5px] ${tab === p ? 'bg-sageDeep border-sageDeep text-white' : 'bg-white border-line text-stone'}`}>
            {p === 'morning' ? '☀️ صبح' : '🌙 شب'}
          </div>
        ))}
      </div>

      {!routine ? (
        <EmptyState title="هنوز روتینی ندارید" body="ابتدا یک اسکن پوست انجام دهید تا روتین شخصی‌سازی‌شده بسازیم." cta="اسکن پوست" onCta={() => navigate('/scan')} />
      ) : (
        routine[tab].map((step, i) => {
          const done = !!today[tab][i];
          return (
            <div key={i} className="flex gap-3.5 mb-3">
              <div className="num w-[34px] h-[34px] rounded-full bg-sageMist text-sageDeep font-extrabold flex items-center justify-center flex-none text-sm">{i + 1}</div>
              <div className="flex-1 bg-white border border-line rounded-md px-4 py-3.5">
                <div className="font-bold text-[14.5px] mb-1">{step.name} — {step.productName}</div>
                <div className="text-[12.5px] text-stone leading-[1.8]">
                  دلیل: {step.reason}<br />روش استفاده: {step.howToUse}<br />تعداد دفعات: {step.frequency}
                  {step.schedule && <><br />روزهای استفاده: {step.schedule.join('، ')}</>}
                </div>
                <div className="flex items-center justify-between mt-2.5">
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${step.importance === 'high' ? 'bg-[#FBEEE9] text-coral' : step.importance === 'mid' ? 'bg-sageMist text-sageDeep' : 'bg-creamDeep text-stone'}`}>
                    {IMPORTANCE_LABEL[step.importance]}
                  </span>
                  <div onClick={() => toggleStep(tab, i)} className="cursor-pointer">
                    <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center text-[13px] text-white ${done ? 'bg-sageDeep border-sageDeep' : 'border-sageSoft'}`}>{done ? '✓' : ''}</div>
                  </div>
                </div>
              </div>
            </div>
          );
        })
      )}

      {routine && (
        <div className="mt-5 flex flex-col gap-2.5">
          <SendRoutineSms />
        </div>
      )}
    </div>
  );
}
