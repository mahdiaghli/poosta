import { useEffect, useRef, useState } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { Chip } from '@/components/ui/Chip';
import { useAppStore } from '@/store/useAppStore';
import { coachService } from '@/services/coachService';
import type { ChatMessage } from '@/types';

const SUGGESTIONS = ['پوستم امروز خیلی خشک شده', 'چطور جوش‌هایم را کم کنم؟', 'روتین شبم چیه؟'];
type Msg = ChatMessage & { action?: { label: string; type: 'skip_tonight_treatment' }; applied?: boolean };

export default function Coach() {
  const { profile, lastScan, routine, myProducts, coachMessages, pushCoachMessage, skipTonightTreatment } = useAppStore((s) => ({
    profile: s.profile, lastScan: s.lastScan, routine: s.routine, myProducts: s.myProducts,
    coachMessages: s.coachMessages, pushCoachMessage: s.pushCoachMessage, skipTonightTreatment: s.skipTonightTreatment,
  }));
  const [input, setInput] = useState('');
  const [applied, setApplied] = useState<Record<number, boolean>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!coachMessages.length) pushCoachMessage(coachService.welcomeMessage());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [coachMessages]);

  const ask = async (text: string) => {
    if (!text.trim()) return;
    pushCoachMessage({ role: 'user', text });
    setInput('');
    const reply = await coachService.reply(text, { profile, lastScan, routine, myProducts });
    pushCoachMessage({ role: 'assistant', text: reply.action ? `${reply.text}\n\n[${reply.action.label}]` : reply.text });
  };

  const msgs = coachMessages as Msg[];

  return (
    <div className="flex flex-col h-[calc(100vh-60px)]">
      <TopBar eyebrow="مربی هوشمند پوست" />
      <h1 className="text-xl font-extrabold mb-3">هر سوالی درباره پوستتان دارید بپرسید</h1>
      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-3">
        {SUGGESTIONS.map((s) => <Chip key={s} label={s} onClick={() => ask(s)} className="whitespace-nowrap" />)}
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto flex flex-col gap-2.5 pb-3.5">
        {msgs.map((m, i) => (
          <div key={i} className={`max-w-[82%] px-4 py-3 rounded-[18px] text-[13.5px] leading-[1.85] whitespace-pre-line ${
            m.role === 'user' ? 'self-end bg-sageDeep text-white rounded-bl-[6px]' : 'self-start bg-white border border-line rounded-br-[6px]'
          }`}>
            {m.text}
            {m.role === 'assistant' && m.text.includes('رد کردن مرحله درمانی امشب') && (
              <button
                disabled={applied[i]}
                onClick={() => { skipTonightTreatment(); setApplied((a) => ({ ...a, [i]: true })); }}
                className="block mt-2 text-xs font-bold text-white bg-sageDeep rounded-full px-3 py-1.5 disabled:opacity-50"
              >
                {applied[i] ? '✓ اعمال شد' : 'اعمال تغییر به روتین امشب'}
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-2 pt-2 sticky bottom-0">
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ask(input)}
          placeholder="پیام خود را بنویسید…" className="flex-1 border-[1.5px] border-line rounded-sm px-4 py-3.5 text-[15px] bg-white" />
        <button onClick={() => ask(input)} className="w-12 flex-none rounded-full bg-sageDeep text-white font-bold">➤</button>
      </div>
    </div>
  );
}
