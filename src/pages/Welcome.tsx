import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { useKioskMode } from '@/hooks/useKioskMode';

export default function Welcome() {
  const navigate = useNavigate();
  const kiosk = useKioskMode();

  return (
    <div className="flex flex-col justify-between min-h-[calc(100vh-140px)] pt-8">
      <div>
        <div className="flex items-center gap-2 font-extrabold text-lg min-[600px]:text-xl text-sageDeep">
          <span className="w-2.5 h-2.5 rounded-full bg-blush" /> پوستا
          {kiosk && <span className="text-xs font-semibold bg-sageMist text-sage rounded-full px-3 py-1">کیوسک داروخانه</span>}
        </div>
        <div className="h-[220px] min-[600px]:h-[280px] rounded-[32px] my-6 relative overflow-hidden shadow-card bg-gradient-to-br from-sageDeep via-sage to-blush flex items-center justify-center flex-col gap-1.5">
          <div className="num text-5xl min-[600px]:text-6xl text-white font-bold">اسکن</div>
          <div className="text-white/85 text-[13px] min-[600px]:text-[15px] font-semibold">
            {kiosk ? 'تحلیل پوست مشتری در کمتر از یک دقیقه' : 'نمونه‌ی امتیاز پوست'}
          </div>
        </div>
        <h1 className="text-2xl min-[600px]:text-[28px] font-extrabold leading-[1.4] text-sageDeep">
          {kiosk ? 'اسکن پوست مشتری را شروع کنید' : 'پوست خود را در ۳۰ ثانیه بشناسید'}
        </h1>
        <p className="text-[14.5px] min-[600px]:text-[16px] text-stone leading-[1.9] mt-2.5">
          {kiosk
            ? 'عکس روبه‌رو با نور یکنواخت بگیرید. نتیجه روی همین تبلت نمایش داده می‌شود؛ برای مشتری بعدی از «پایان نوبت» استفاده کنید.'
            : 'با هوش مصنوعی پوستا، وضعیت پوستتان را از روی یک عکس تحلیل کنید، امتیاز پوست بگیرید و روتین و محصولات متناسب با خودتان را دریافت کنید.'}
        </p>
      </div>
      <div className="flex flex-col gap-2.5 mt-6">
        {kiosk ? (
          <>
            <Button onClick={() => navigate('/consent')}>شروع اسکن مشتری</Button>
            <Button variant="ghost" onClick={() => navigate('/auth')}>ورود کارکنان</Button>
          </>
        ) : (
          <>
            <Button onClick={() => navigate('/onboarding')}>تحلیل پوست من</Button>
            <Button variant="secondary" onClick={() => navigate('/auth')}>ورود / ثبت‌نام</Button>
          </>
        )}
      </div>
    </div>
  );
}
