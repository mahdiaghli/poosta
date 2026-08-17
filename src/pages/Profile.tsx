import { useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAppStore } from '@/store/useAppStore';
import { METRIC_LABELS_FA } from '@/types';

const SKIN_TYPE_FA: Record<string, string> = { oily: 'چرب', dry: 'خشک', combination: 'مختلط', normal: 'نرمال', unknown: 'نامشخص' };

export default function Profile() {
  const navigate = useNavigate();
  const user = useAppStore((s) => s.user);
  const profile = useAppStore((s) => s.profile);
  const reminders = useAppStore((s) => s.reminders);
  const setReminders = useAppStore((s) => s.setReminders);
  const requestNotifications = useAppStore((s) => s.requestNotifications);

  return (
    <div>
      <TopBar eyebrow="پروفایل" />
      <div className="flex items-center gap-3.5 mb-5.5">
        <div className="w-[60px] h-[60px] rounded-full bg-blushSoft text-coral flex items-center justify-center font-extrabold text-xl flex-none">{(user?.name ?? '?')[0]}</div>
        <div>
          <div className="font-extrabold text-base">{user?.name ?? 'کاربر مهمان'}</div>
          <div className="text-[12.5px] text-stone">{user?.email ?? user?.phone ?? 'وارد نشده‌اید'}</div>
        </div>
      </div>

      <Card className="mb-3.5">
        <h2 className="text-[17px] font-bold mb-3.5">پروفایل پوستی</h2>
        <Row label="سن" value={profile.age ? String(profile.age) : 'ثبت نشده'} />
        <Row label="نوع پوست" value={profile.skinType ? SKIN_TYPE_FA[profile.skinType] : 'ثبت نشده'} />
        <Row label="دغدغه‌های اصلی" value={profile.concerns.map((c) => METRIC_LABELS_FA[c]).join('، ') || '—'} />
        <Row label="اهداف" value={`${profile.goals.length} هدف انتخاب‌شده`} last />
        <div className="mt-3.5"><Button variant="secondary" onClick={() => navigate('/onboarding')}>ویرایش پروفایل پوستی</Button></div>
      </Card>

      <Card className="mb-3.5">
        <h2 className="text-[17px] font-bold mb-3.5">یادآورها و اعلان‌ها</h2>
        <Button variant="secondary" className="mb-3" onClick={async () => { const p = await requestNotifications(); alert(p === "granted" ? "اعلان‌های واقعی پوستا فعال شد." : "اجازه اعلان در مرورگر فعال نیست."); }}>🔔 فعال‌کردن اعلان‌ها</Button>
        <div className="flex items-center justify-between py-3.5 border-b border-line">
          <span>☀️ یادآور روتین صبح</span>
          <input type="time" value={reminders.morning} onChange={(e) => setReminders({ ...reminders, morning: e.target.value })}
            className="border-[1.5px] border-line rounded-md px-2.5 py-2 bg-white" />
        </div>
        <div className="flex items-center justify-between py-3.5 border-b border-line">
          <span>🌙 یادآور روتین شب</span>
          <input type="time" value={reminders.night} onChange={(e) => setReminders({ ...reminders, night: e.target.value })}
            className="border-[1.5px] border-line rounded-md px-2.5 py-2 bg-white" />
        </div>
        <div className="flex items-center justify-between py-3.5">
          <span>فعال بودن یادآورها</span>
          <Toggle on={reminders.enabled} onClick={() => setReminders({ ...reminders, enabled: !reminders.enabled })} />
        </div>
      </Card>

      <Card className="mb-3.5">
        <h2 className="text-[17px] font-bold mb-3.5">دسترسی سریع</h2>
        {[['🧺 محصولات من', '/my-products'], ['📅 برنامه هفتگی روتین', '/routine/weekly'], ['🧪 Patch Test', '/patch-test'], ['✅ چک‌این امروز', '/check-in'], ['📔 دفترچه پوست', '/diary'], ['🔬 اسکنر مواد تشکیل‌دهنده', '/ingredients'], ['🤖 مربی هوشمند پوست', '/coach'], ['🔒 حریم خصوصی و داده چهره', '/privacy']].map(([label, path]) => (
          <div key={path} onClick={() => navigate(path)} className="flex items-center justify-between py-3.5 border-b border-line last:border-none cursor-pointer">
            <span>{label}</span><span className="text-stone">‹</span>
          </div>
        ))}
      </Card>

      <Card>
        <h2 className="text-[17px] font-bold mb-3.5">تنظیمات</h2>
        <Row label="زبان" value="فارسی" bold />
      </Card>
    </div>
  );
}

function Row({ label, value, last, bold }: { label: string; value: string; last?: boolean; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-3.5 ${last ? '' : 'border-b border-line'} text-sm`}>
      <span>{label}</span><span className={bold ? 'font-bold text-sageDeep' : ''}>{value}</span>
    </div>
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <div onClick={onClick} className={`w-11 h-[26px] rounded-full relative cursor-pointer transition-colors ${on ? 'bg-sageDeep' : 'bg-line'}`}>
      <span className={`absolute top-[3px] w-5 h-5 rounded-full bg-white transition-transform ${on ? 'right-[3px]' : 'right-[21px]'}`} />
    </div>
  );
}
