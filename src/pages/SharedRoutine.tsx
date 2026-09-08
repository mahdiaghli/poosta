import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { TopBar } from '@/components/layout/TopBar';
import { MedicalDisclaimer } from '@/components/ui/MedicalDisclaimer';
import { routineShareService } from '@/services/routineShareService';

type SharedPayload = {
  overallScore?: number | null;
  routine?: {
    morning: { name: string; productName: string; reason?: string; howToUse?: string; frequency?: string; schedule?: string[] }[];
    night: { name: string; productName: string; reason?: string; howToUse?: string; frequency?: string; schedule?: string[] }[];
    conflicts?: { message: string }[];
  };
  weekly?: {
    day: string;
    morning: { name: string; productName: string; frequency?: string }[];
    night: { name: string; productName: string; frequency?: string }[];
  }[];
  expires_at?: string;
};

export default function SharedRoutine() {
  const { token } = useParams();
  const [tab, setTab] = useState<'daily' | 'weekly'>('daily');
  const [period, setPeriod] = useState<'morning' | 'night'>('morning');
  const [data, setData] = useState<SharedPayload | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    routineShareService.getShared(token)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'خطا'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return <div className="py-20 text-center text-stone">در حال بارگذاری روتین…</div>;
  }
  if (error || !data?.routine) {
    return (
      <div>
        <TopBar eyebrow="روتین پوستا" />
        <Card><p className="text-stone leading-7">{error || 'روتین در دسترس نیست.'}</p></Card>
      </div>
    );
  }

  const steps = data.routine[period] || [];

  return (
    <div>
      <TopBar eyebrow="روتین مراقبت پوست" />
      <h1 className="text-[22px] font-extrabold text-sageDeep">روتین شما</h1>
      {data.overallScore != null && (
        <p className="text-[13px] text-stone mt-1">امتیاز کلی پوست در زمان اسکن: {data.overallScore}</p>
      )}
      {data.expires_at && (
        <p className="text-[11.5px] text-stone mt-1">اعتبار لینک تا {new Date(data.expires_at).toLocaleDateString('fa-IR')}</p>
      )}

      <div className="flex bg-sageMist rounded-full p-1 mt-4 mb-3">
        {([['daily', 'روزانه'], ['weekly', 'هفتگی']] as const).map(([k, label]) => (
          <div key={k} onClick={() => setTab(k)}
            className={`flex-1 text-center py-2.5 rounded-full text-[13px] font-bold cursor-pointer ${tab === k ? 'bg-sageDeep text-white' : 'text-sageDeep'}`}>
            {label}
          </div>
        ))}
      </div>

      {tab === 'daily' ? (
        <>
          <div className="flex gap-2 mb-4">
            {([['morning', '☀️ صبح'], ['night', '🌙 شب']] as const).map(([k, label]) => (
              <div key={k} onClick={() => setPeriod(k)}
                className={`flex-1 text-center py-2.5 rounded-full font-bold text-[13px] cursor-pointer border-[1.5px] ${period === k ? 'bg-sageDeep border-sageDeep text-white' : 'bg-white border-line text-stone'}`}>
                {label}
              </div>
            ))}
          </div>
          {data.routine.conflicts?.map((c, i) => (
            <div key={i} className="bg-[#FBEEE9] border border-[#F0CFC3] text-coral rounded-md px-4 py-3 text-[13px] mb-3">{c.message}</div>
          ))}
          {steps.map((s, i) => (
            <Card key={i} className="mb-3">
              <div className="font-bold text-[14.5px]">{i + 1}. {s.name} — {s.productName}</div>
              {s.reason && <p className="text-[12.5px] text-stone mt-1 leading-[1.8]">دلیل: {s.reason}</p>}
              {s.howToUse && <p className="text-[12.5px] text-stone leading-[1.8]">روش: {s.howToUse}</p>}
              {s.frequency && <p className="text-[12px] text-stone mt-1">{s.frequency}</p>}
              {s.schedule?.length ? <p className="text-[12px] text-stone">روزها: {s.schedule.join('، ')}</p> : null}
            </Card>
          ))}
        </>
      ) : (
        <div className="space-y-3">
          {(data.weekly || []).map((day) => (
            <Card key={day.day}>
              <b className="text-sageDeep">{day.day}</b>
              <div className="mt-2 text-[12.5px]">
                <div className="font-bold text-stone mb-1">صبح</div>
                {day.morning.length
                  ? day.morning.map((s, i) => <div key={i} className="py-1 border-b border-line last:border-none">{s.name} — {s.productName}</div>)
                  : <div className="text-stone py-1">روز ریکاوری</div>}
                <div className="font-bold text-stone mt-2 mb-1">شب</div>
                {day.night.length
                  ? day.night.map((s, i) => <div key={i} className="py-1 border-b border-line last:border-none">{s.name} — {s.productName}</div>)
                  : <div className="text-stone py-1">روز ریکاوری</div>}
              </div>
            </Card>
          ))}
        </div>
      )}

      <MedicalDisclaimer />
    </div>
  );
}
