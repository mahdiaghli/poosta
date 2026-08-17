import type { SkinAnalysisResult, ImageQualityResult, SkinProfile, SkinMetricKey } from '@/types';
import { analyzePixels, type PixelStats } from './imageAnalysis';

/** How much each metric drives the overall score — NOT a simple average. */
const METRIC_WEIGHTS: Record<SkinMetricKey, number> = {
  acne: 0.17, oiliness: 0.10, hydration: 0.16, redness: 0.11,
  pores: 0.10, darkSpots: 0.12, texture: 0.13, fineLines: 0.11,
};

/**
 * checkImageQuality — real pixel-derived checks (brightness/contrast/
 * sharpness/resolution), replacing the old Math.random() placeholder (#2, #3).
 * Face-count/pose/occlusion genuinely need a face-detection model — those
 * stay TODOs with clear swap comments rather than being faked.
 */
async function checkImageQuality(imageDataUrl: string): Promise<ImageQualityResult> {
  try {
    const res = await fetch('/api/skin-quality', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageDataUrl }) });
    const body = await res.json().catch(() => ({}));
    if (res.ok && body?.imageQuality) {
      return { ok: Boolean(body.imageQuality.suitable), issues: (body.imageQuality.issues ?? []).map((message: string, i: number) => ({ code: `ai_${i}`, message })) };
    }
    if (res.status === 503) return { ok: false, issues: [{ code: 'ai_unavailable', message: 'سرویس تحلیل تصویری در دسترس نیست. سرور AI و کلید API را بررسی کنید.' }] };
    return { ok: false, issues: [{ code: 'ai_quality_failed', message: body?.message || 'بررسی کیفیت تصویر انجام نشد.' }] };
  } catch {
    return { ok: false, issues: [{ code: 'server_unreachable', message: 'سرور تحلیل در دسترس نیست. ابتدا npm run api را اجرا کنید.' }] };
  }
}

/**
 * Deterministic, image-derived heuristic (brightness/contrast/redness/
 * sharpness proxies), replacing the old pure-Math.random mock (#1). This is
 * still NOT a dermatological model — same photo -> same result now, and the
 * signals are visually motivated, but it must be swapped for a real trained
 * model before any clinical-sounding claim is made. See analyzeSkin() below
 * for the exact swap point.
 */
function heuristicAnalyze(stats: PixelStats, profile: SkinProfile): SkinAnalysisResult {
  const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

  // Brighter, more even-toned skin regions read as more "hydrated" and less "textured/lined".
  const brightnessScore = clamp((stats.meanBrightness / 255) * 100);
  const evenness = clamp(100 - stats.contrast * 1.2); // lower local variance -> smoother reading
  const redness = clamp(100 - stats.redness);          // more red channel dominance -> lower redness score
  const oilinessProxy = clamp(100 - Math.abs(stats.warmth - 30) * 1.5); // very rough proxy, needs a real model
  const sharpnessProxy = clamp(stats.sharpness * 3);    // more high-frequency detail read as visible texture/pores

  const metrics: Record<SkinMetricKey, number> = {
    hydration: clamp((brightnessScore + evenness) / 2),
    redness,
    oiliness: oilinessProxy,
    acne: clamp((evenness + redness) / 2),
    pores: clamp(100 - sharpnessProxy * 0.6),
    darkSpots: clamp(evenness),
    texture: clamp((evenness + brightnessScore) / 2),
    fineLines: clamp(100 - sharpnessProxy * 0.4),
  };

  const goalMap: Partial<Record<string, SkinMetricKey>> = {
    acne: 'acne', spots: 'darkSpots', redness: 'redness', oil: 'oiliness', hydration: 'hydration', texture: 'texture',
  };
  profile.goals.forEach((g) => { const k = goalMap[g]; if (k) metrics[k] = Math.max(30, metrics[k] - 10); });
  profile.concerns.forEach((c) => { if (metrics[c] !== undefined) metrics[c] = Math.max(30, metrics[c] - 8); });

  let weightedSum = 0, weightTotal = 0;
  (Object.keys(metrics) as SkinMetricKey[]).forEach((k) => {
    weightedSum += metrics[k] * METRIC_WEIGHTS[k];
    weightTotal += METRIC_WEIGHTS[k];
  });
  const overallScore = Math.round(weightedSum / weightTotal);

  const topOpportunities = (Object.keys(metrics) as SkinMetricKey[])
    .map((k) => [k, METRIC_WEIGHTS[k] * (100 - metrics[k])] as const)
    .sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => k);

  const concerns = (Object.keys(metrics) as SkinMetricKey[]).filter((k) => metrics[k] < 50);

  // Confidence reflects image quality signals we actually measured, not a random number.
  const confidence = Math.round(Math.max(0.4, Math.min(0.95,
    0.5 + (stats.sharpness / 40) + (stats.contrast > 10 ? 0.1 : 0)
  )) * 100) / 100;

  return {
    overallScore, metrics, concerns, topOpportunities, confidence,
    provider: 'heuristic-v2', createdAt: new Date().toISOString(),
  };
}

/**
 */
const endpoint = import.meta.env.VITE_SKIN_AI_ENDPOINT?.trim() || '/api/skin-analysis';

function validateProviderResult(value: unknown): SkinAnalysisResult {
  const raw = value as Partial<SkinAnalysisResult> | null;
  if (!raw || typeof raw !== 'object' || !raw.metrics) throw new Error('پاسخ تحلیل پوست معتبر نیست.');
  const keys: SkinMetricKey[] = ['acne','oiliness','hydration','redness','pores','darkSpots','texture','fineLines'];
  const metrics = {} as Record<SkinMetricKey, number>;
  for (const key of keys) {
    const n = Number((raw.metrics as Record<string, unknown>)[key]);
    if (!Number.isFinite(n)) throw new Error('یکی از شاخص‌های تحلیل پوست نامعتبر است.');
    metrics[key] = Math.max(0, Math.min(100, Math.round(n)));
  }
  if (!raw.imageQuality?.suitable) throw new Error(raw.imageQuality?.issues?.[0] || 'این عکس برای تحلیل مناسب نیست.');
  return {
    overallScore: Math.max(0, Math.min(100, Math.round(Number(raw.overallScore ?? 50)))),
    metrics,
    concerns: Array.isArray(raw.concerns) ? raw.concerns.filter((x): x is SkinMetricKey => keys.includes(x as SkinMetricKey)) : [],
    topOpportunities: Array.isArray(raw.topOpportunities) ? raw.topOpportunities.filter((x): x is SkinMetricKey => keys.includes(x as SkinMetricKey)) : [],
    confidence: Math.max(0.35, Math.min(0.98, Number(raw.confidence ?? 0.6))),
    provider: raw.provider || 'vision-ai', createdAt: raw.createdAt || new Date().toISOString(),
    imageQuality: raw.imageQuality, observations: Array.isArray(raw.observations) ? raw.observations : [],
    limitations: Array.isArray(raw.limitations) ? raw.limitations : [], recommendedNextStep: raw.recommendedNextStep,
  };
}

export const skinAnalysisService = {
  provider: 'local-heuristic-v2',
  async checkImageQuality(imageDataUrl: string): Promise<ImageQualityResult> {
    try {
      const stats = await analyzePixels(imageDataUrl);
      const issues: {code:string;message:string}[]=[];
      if (stats.width < 400 || stats.height < 400) issues.push({code:'low_resolution',message:'رزولوشن تصویر پایین است.'});
      if (stats.meanBrightness < 55) issues.push({code:'too_dark',message:'نور تصویر کم است.'});
      if (stats.meanBrightness > 225) issues.push({code:'too_bright',message:'نور تصویر بیش از حد زیاد است.'});
      if (stats.contrast < 8) issues.push({code:'low_contrast',message:'کنتراست تصویر پایین است.'});
      if (stats.sharpness < 2) issues.push({code:'blurry',message:'تصویر ممکن است تار باشد.'});
      return {ok:issues.length===0,issues};
    } catch {
      return {ok:false,issues:[{code:'invalid_image',message:'خواندن تصویر ممکن نیست.'}]};
    }
  },
  async analyzeSkin(imageDataUrl: string, profile: SkinProfile): Promise<SkinAnalysisResult> {
    const stats=await analyzePixels(imageDataUrl);
    const q=await this.checkImageQuality(imageDataUrl);
    if(!q.ok) throw new Error(q.issues[0]?.message || 'این عکس برای تحلیل مناسب نیست.');
    const result=heuristicAnalyze(stats,profile);
    result.provider='local-heuristic-v2';
    result.imageQuality={ suitable:true, faceDetected:false, faceCount:0, frontal:false, faceVisibility:'partial', qualityScore:Math.max(0,Math.min(1,1-q.issues.length/5)), issues:[] };
    result.limitations=['این نسخه مدل بینایی/تشخیص چهره آموزش‌دیده ندارد و شاخص‌ها تقریبی هستند.'];
    result.recommendedNextStep='برای نسخه دقیق‌تر، مدل خودتان را در models/skin قرار دهید و آداپتر آن را جایگزین heuristicAnalyze کنید.';
    return result;
  },
};
