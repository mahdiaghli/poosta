import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';

export default function Welcome() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col justify-between min-h-[calc(100vh-140px)] pt-8">
      <div>
        <div className="flex items-center gap-2 font-extrabold text-lg text-sageDeep">
          <span className="w-2.5 h-2.5 rounded-full bg-blush" /> پوستا
        </div>
        <div className="h-[280px] rounded-[32px] my-6 relative overflow-hidden shadow-card bg-gradient-to-br from-sageDeep via-sage to-blush flex items-center justify-center flex-col gap-1.5">
          <div className="num text-5xl text-white font-bold">۹۲</div>
          <div className="text-white/85 text-[13px] font-semibold">نمونه‌ی امتیاز پوست</div>
        </div>
        <h1 className="text-2xl font-extrabold leading-[1.4] text-sageDeep">پوست خود را در ۳۰ ثانیه بشناسید</h1>
        <p className="text-[14.5px] text-stone leading-[1.9] mt-2.5">
          با هوش مصنوعی پوستا، وضعیت پوستتان را از روی یک عکس تحلیل کنید، امتیاز پوست بگیرید و روتین و محصولات متناسب با خودتان را دریافت کنید.
        </p>
      </div>
      <div className="flex flex-col gap-2.5 mt-6">
        <Button onClick={() => navigate('/onboarding')}>تحلیل پوست من</Button>
        <Button variant="secondary" onClick={() => navigate('/auth')}>ورود / ثبت‌نام</Button>
      </div>
    </div>
  );
}
