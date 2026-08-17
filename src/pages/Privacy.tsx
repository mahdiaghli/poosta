import { useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAppStore } from '@/store/useAppStore';
import { privacyService } from '@/services/privacyService';

export default function Privacy() {
  const navigate = useNavigate();
  const store = useAppStore();
  const { user, scanHistory, myProducts, resetAccount } = store;

  const exportData = () => privacyService.exportData(store);

  const deleteHistory = async () => {
    if (!confirm('تاریخچه تحلیل و عکس‌های پوست شما حذف شود؟')) return;
    await privacyService.deleteScanHistory(user?.id);
    useAppStore.setState({ scanHistory: [], lastScan: null, lastComparison: null });
    alert('تاریخچه با موفقیت حذف شد.');
  };

  const deleteAccount = async () => {
    if (!confirm('حساب کاربری و تمام داده‌های شما برای همیشه حذف شود؟')) return;
    await privacyService.deleteAccount(user?.id);
    resetAccount();
    navigate('/welcome');
  };

  return (
    <div>
      <TopBar showBack eyebrow="حریم خصوصی" />
      <h1 className="text-[21px] font-extrabold text-sageDeep">حریم خصوصی و داده‌های چهره شما</h1>
      <p className="text-[14.5px] text-stone leading-[1.9] mt-2.5">
        تصویر اصلی صورت شما فقط در حافظه موقت مرورگر برای مدت تحلیل پردازش و سپس حذف می‌شود. یک تصویر بندانگشتی
        کوچک برای مقایسه‌ی «قبل/بعد» ذخیره می‌ماند تا وقتی خودتان آن را حذف کنید. هیچ داده‌ای بدون رضایت صریح شما
        برای آموزش مدل هوش مصنوعی استفاده نمی‌شود و شخص ثالثی به آن دسترسی ندارد.
      </p>
      <Card className="mt-4.5 mb-3.5">
        <h2 className="text-[17px] font-bold mb-3.5">داده‌های ذخیره‌شده</h2>
        <div className="flex items-center justify-between py-3 border-b border-line"><span>تعداد اسکن‌های ذخیره‌شده</span><span className="num">{scanHistory.length}</span></div>
        <div className="flex items-center justify-between py-3"><span>محصولات ثبت‌شده</span><span className="num">{myProducts.length}</span></div>
      </Card>
      <Card className="flex flex-col gap-2.5">
        <Button variant="secondary" onClick={exportData}>خروجی گرفتن از داده‌های من</Button>
        <Button variant="secondary" onClick={deleteHistory}>حذف تاریخچه تحلیل و عکس‌ها</Button>
        <Button variant="danger" onClick={deleteAccount}>حذف حساب کاربری</Button>
      </Card>
    </div>
  );
}
