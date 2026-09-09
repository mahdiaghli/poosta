import { useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ScoreRing } from '@/components/ui/ScoreRing';
import { MetricBar } from '@/components/ui/MetricBar';
import { MedicalDisclaimer } from '@/components/ui/MedicalDisclaimer';
import { useAppStore } from '@/store/useAppStore';
import { METRIC_LABELS_FA, type SkinMetricKey } from '@/types';
import { SendRoutineSms } from '@/components/SendRoutineSms';
import { KioskVisitActions } from '@/components/KioskVisitActions';
import { useKioskMode } from '@/hooks/useKioskMode';

export default function Result() {
  const navigate = useNavigate();
  const kiosk = useKioskMode();
  const lastScan = useAppStore((s) => s.lastScan);
  const comparison = useAppStore((s) => s.lastComparison);
  if (!lastScan) { navigate('/scan', { replace: true }); return null; }

  const worst = (Object.entries(lastScan.metrics) as [SkinMetricKey, number][]).sort((a, b) => a[1] - b[1])[0];
  const opportunities = (lastScan.topOpportunities.length ? lastScan.topOpportunities : [worst[0]])
    .map((k) => METRIC_LABELS_FA[k]).join(' و ');

  return (
    <div>
      <TopBar
        eyebrow="نتیجه تحلیل"
        right={
          <button
            onClick={() => navigate(kiosk ? '/scan' : '/home')}
            className="w-9 h-9 min-[600px]:w-12 min-[600px]:h-12 rounded-full bg-white border border-line flex items-center justify-center"
          >
            ✕
          </button>
        }
      />

      {comparison && (
        <div className="bg-sageMist border border-sageSoft text-sageDeep rounded-md px-4 py-3.5 text-[13.5px] min-[600px]:text-[15px] font-bold mb-4 flex items-center gap-2">
          {comparison.diff >= 0 ? '📈' : '📉'} امتیاز پوست شما نسبت به تحلیل قبلی ({comparison.prevOverall})
          {' '}{Math.abs(comparison.diff)} امتیاز {comparison.diff >= 0 ? 'بهتر شده' : 'کاهش یافته'} است.
        </div>
      )}

      <div className="flex flex-col items-center gap-2.5 py-4 min-[600px]:py-5">
        <div className="relative w-[190px] h-[190px] min-[600px]:w-[220px] min-[600px]:h-[220px]">
          <ScoreRing score={lastScan.overallScore} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="num text-[46px] min-[600px]:text-[52px] font-bold text-sageDeep leading-none">{lastScan.overallScore}</div>
            <div className="text-[13px] min-[600px]:text-[14px] text-stone mt-1">از ۱۰۰</div>
          </div>
        </div>
        <div className="font-bold text-sageDeep min-[600px]:text-lg">امتیاز کلی پوست</div>
        {lastScan.apparentSkinAge != null && (
          <div className="mt-2 text-center">
            <div className="text-[28px] min-[600px]:text-[32px] font-extrabold text-sageDeep num">{lastScan.apparentSkinAge}</div>
            <div className="text-[13px] min-[600px]:text-[15px] font-bold text-sageDeep">سن ظاهری پوست</div>
            <div className="text-[11.5px] min-[600px]:text-[13px] text-stone mt-1 max-w-[280px] min-[600px]:max-w-md leading-[1.7]">
              {lastScan.apparentSkinAgeNote || 'برآورد ظاهری از روی بافت و خطوط پوست — سن واقعی شما نیست.'}
            </div>
          </div>
        )}
        <div className="text-[11.5px] min-[600px]:text-[13px] text-stone">اعتمادپذیری تحلیل تصویری: {Math.round(lastScan.confidence * 100)}٪</div>
      </div>

      <Card className="mt-2">
        <h2 className="text-[17px] min-[600px]:text-[19px] font-bold mb-3.5">شاخص‌های پوستی</h2>
        <div className="min-[600px]:grid min-[600px]:grid-cols-2 min-[600px]:gap-x-6">
          {(Object.entries(lastScan.metrics) as [SkinMetricKey, number][]).map(([k, v]) => (
            <MetricBar key={k} label={METRIC_LABELS_FA[k]} value={v} source={lastScan.metricsSource?.[k]} />
          ))}
        </div>
      </Card>

      {/* {lastScan.observations?.length ? (
        kiosk ? (
          <details className="mt-4 bg-card rounded-lg p-5 shadow-card border border-line">
            <summary className="font-bold text-[16px] cursor-pointer">جزئیات فنی</summary>
            <ul className="list-disc mr-5 space-y-1.5 text-[14px] text-stone leading-[1.9] mt-3">
              {lastScan.observations.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </details>
        ) : (
          <Card className="mt-4">
            <h2 className="text-[17px] font-bold mb-3.5">یافته‌های قابل مشاهده</h2>
            <ul className="list-disc mr-5 space-y-1.5 text-[14px] text-stone leading-[1.9]">
              {lastScan.observations.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </Card>
        )
      ) : null} */}

      <Card className="mt-4">
        <h2 className="text-[17px] min-[600px]:text-[19px] font-bold mb-3.5">خلاصه تحلیل</h2>
        <p className="text-[14.5px] min-[600px]:text-[16px] text-stone leading-[1.9] mt-0">
          پوست شما به‌طور کلی امتیاز {lastScan.overallScore} از ۱۰۰ گرفته است. این امتیاز از میانگین ساده محاسبه نشده
          و بر اساس اهمیت هرکدام از شاخص‌ها وزن‌دهی شده است. این یک تشخیص پزشکی نیست؛ بلکه یک برآورد ظاهری برای کمک
          به انتخاب روتین مناسب شماست.
        </p>
        <p className="text-[14.5px] min-[600px]:text-[16px] font-semibold text-sageDeep mt-2">بیشترین فرصت بهبود شما: {opportunities}</p>
        {worst[1] < 45 && (
          <div className="inline-flex items-center gap-1.5 bg-[#FBEEE9] text-coral text-xs min-[600px]:text-sm font-bold px-3 py-1.5 rounded-full mt-3.5">
            ⚠ این تحلیل تشخیص پزشکی نیست؛ در صورت ادامه‌دار بودن مشکل به متخصص پوست مراجعه کنید
          </div>
        )}
        <MedicalDisclaimer />
      </Card>

      {!kiosk && (
        <div className="flex flex-col gap-2.5 mt-5">
          <Button onClick={() => navigate('/routine')}>مشاهده روتین پیشنهادی</Button>
          <SendRoutineSms />
          <KioskVisitActions />
          <Button variant="secondary" onClick={() => navigate('/home')}>بازگشت به خانه</Button>
        </div>
      )}

      {kiosk && (
        <div className="fixed bottom-[calc(72px+env(safe-area-inset-bottom))] min-[600px]:bottom-[calc(80px+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 w-full max-w-[480px] min-[600px]:max-w-[720px] px-[22px] min-[600px]:px-8 z-40">
          <div className="bg-white/95 backdrop-blur-md border border-line rounded-2xl p-3 shadow-card">
            <div className="grid grid-cols-2 gap-2 mb-2">
              <Button onClick={() => navigate('/routine')}>روتین</Button>
              <Button variant="secondary" onClick={() => navigate('/print/kiosk')}>چاپ برای فروشنده</Button>
            </div>
            <SendRoutineSms />
            <KioskVisitActions compact />
          </div>
        </div>
      )}
    </div>
  );
}
