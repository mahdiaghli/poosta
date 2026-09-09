import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useAppStore } from '@/store/useAppStore';
import { routineShareService } from '@/services/routineShareService';
import { getLastServerScanId } from '@/services/kioskHandoffService';

export function SendRoutineSms() {
  const routine = useAppStore((s) => s.routine);
  const lastScan = useAppStore((s) => s.lastScan);
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ url: string; mocked: boolean } | null>(null);

  if (!routine) return null;

  const submit = async () => {
    setError('');
    setLoading(true);
    setDone(null);
    try {
      const out = await routineShareService.sendRoutineSms(
        phone,
        routine,
        lastScan?.overallScore,
        getLastServerScanId(),
      );
      setDone({ url: out.url, mocked: out.sms.mocked });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ارسال ناموفق بود.');
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        ارسال روتین با پیامک
      </Button>
    );
  }

  return (
    <Card className="mt-1">
      <h3 className="text-[15px] font-bold text-sageDeep mb-2">ارسال روتین به موبایل</h3>
      <p className="text-[12.5px] text-stone leading-[1.8] mb-3">
        لینک روتین روزانه و هفتگی با پیامک ارسال می‌شود. عکس چهره ارسال نمی‌شود.
      </p>
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="09xxxxxxxxx"
        inputMode="tel"
        className="w-full rounded-xl border border-line bg-white px-3 min-h-12 py-3 text-[15px] outline-none focus:border-sage"
        dir="ltr"
      />
      {error && <p className="mt-2 text-[12.5px] text-rose-700">{error}</p>}
      {done && (
        <div className="mt-3 text-[12.5px] text-sageDeep leading-[1.8] break-all">
          {done.mocked
            ? 'کلید پیامک تنظیم نشده؛ لینک در کنسول سرور ثبت شد. می‌توانید لینک را کپی کنید:'
            : 'پیامک ارسال شد. لینک:'}
          <div className="mt-1 font-mono text-[11px] bg-sageMist rounded-lg px-2 py-2">{done.url}</div>
        </div>
      )}
      <div className="flex gap-2 mt-3">
        <Button disabled={loading || phone.trim().length < 10} onClick={submit}>
          {loading ? 'در حال ارسال…' : 'ارسال پیامک'}
        </Button>
        <Button variant="secondary" onClick={() => { setOpen(false); setDone(null); setError(''); }}>
          بستن
        </Button>
      </div>
    </Card>
  );
}
