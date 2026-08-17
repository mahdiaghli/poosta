import type { ChatMessage, Routine, SkinAnalysisResult, SkinProfile, OwnedProduct, SkinMetricKey } from '@/types';
import { METRIC_LABELS_FA } from '@/types';

export interface CoachReply { text: string; action?: { label: string; type: 'skip_tonight_treatment' } }

export interface CoachContext {
  profile: SkinProfile;
  lastScan: SkinAnalysisResult | null;
  routine: Routine | null;
  myProducts: OwnedProduct[];
}

/**
 * coachService — context-aware assistant, NOT a generic chatbot. buildContext
 * gathers exactly what a real LLM call would receive as grounding context.
 * SWAP POINT: replace `reply()`'s body with a real call, e.g.
 *   const res = await fetch('/functions/v1/skin-coach', { method: 'POST', body: JSON.stringify({ message, context }) });
 *   return (await res.json()).reply;
 */
export const coachService = {
  async reply(message: string, ctx: CoachContext): Promise<CoachReply> {
    await new Promise((r) => setTimeout(r, 700));
    const worst = ctx.lastScan
      ? (Object.entries(ctx.lastScan.metrics) as [SkinMetricKey, number][]).sort((a, b) => a[1] - b[1])[0][0]
      : null;

    if (/خشک|dry|رطوبت/.test(message)) {
      const step = ctx.routine?.night.find((s) => s.name === 'مرطوب‌کننده');
      const hasNightActive = ctx.routine?.night.some((s) => s.activeIngredientKeys.length > 0);
      return {
        text: `با توجه به وضعیت پوست شما${ctx.lastScan ? ` (امتیاز رطوبت: ${ctx.lastScan.metrics.hydration})` : ''}، پیشنهاد می‌کنم امشب از ${step ? step.productName : 'یک مرطوب‌کننده سبک'} استفاده کنید${hasNightActive ? ' و مرحله درمانی (رتینول/اسید) را امشب رد کنید' : ''}. اگر خشکی شدید یا ادامه‌دار بود، با متخصص پوست مشورت کنید.`,
        action: hasNightActive ? { label: 'رد کردن مرحله درمانی امشب', type: 'skip_tonight_treatment' } : undefined,
      };
    }
    if (/جوش|acne|آکنه/.test(message)) {
      return { text: 'برای کاهش جوش، شست‌وشوی ملایم دوبار در روز و استفاده از سرم حاوی نیاسینامید یا BHA می‌تواند کمک‌کننده باشد. از دستکاری جوش‌ها خودداری کنید. اگر جوش‌ها التهابی و دردناک هستند، مراجعه به متخصص پوست توصیه می‌شود.' };
    }
    if (/روتین|routine/.test(message)) {
      if (!ctx.routine) return { text: 'هنوز روتینی برای شما ساخته نشده. یک اسکن پوست انجام دهید تا روتین اختصاصی شما آماده شود.' };
      const m = ctx.routine.morning.map((s) => s.name).join('، ');
      const n = ctx.routine.night.map((s) => s.name).join('، ');
      return { text: `روتین صبح شما: ${m}\nروتین شب شما: ${n}` };
    }
    if (worst) {
      return { text: `با نگاهی به آخرین تحلیل شما، بیشترین فرصت بهبود در «${METRIC_LABELS_FA[worst]}» است. به روتین پیشنهادی پایبند بمانید و در صورت تشدید علائم با متخصص پوست مشورت کنید.` };
    }
    return { text: 'برای پاسخ دقیق‌تر، ابتدا یک اسکن پوست انجام دهید. من جایگزین مشاوره پزشکی نیستم و در موارد جدی مراجعه به متخصص پوست را توصیه می‌کنم.' };
  },

  welcomeMessage(): ChatMessage {
    return { role: 'assistant', text: 'سلام! من مربی هوشمند پوست شما هستم و بر اساس پروفایل و آخرین تحلیل پوستتان پاسخ می‌دهم. چه چیزی می‌خواهید بدانید؟' };
  },
};
