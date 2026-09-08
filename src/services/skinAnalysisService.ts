import type { SkinAnalysisResult, ImageQualityResult, SkinProfile, SkinMetricKey } from '@/types';
import { analyzePixels } from './imageAnalysis';

const KEYS: SkinMetricKey[] = ['acne','oiliness','hydration','redness','pores','darkSpots','texture','fineLines'];

function validateProviderResult(value: unknown): SkinAnalysisResult {
  const raw = value as Partial<SkinAnalysisResult> | null;
  if (!raw || typeof raw !== 'object' || !raw.metrics) throw new Error('پاسخ تحلیل پوست معتبر نیست.');
  const metrics = {} as Record<SkinMetricKey, number>;
  for (const key of KEYS) {
    const n = Number((raw.metrics as Record<string, unknown>)[key]);
    if (!Number.isFinite(n)) throw new Error(`شاخص ${key} نامعتبر است.`);
    metrics[key] = Math.max(0, Math.min(100, Math.round(n)));
  }
  if (!raw.imageQuality?.suitable) throw new Error(raw.imageQuality?.issues?.[0] || 'این عکس برای تحلیل مناسب نیست.');
  return {
    overallScore: Math.max(0, Math.min(100, Math.round(Number(raw.overallScore ?? 50)))),
    metrics,
    concerns: Array.isArray(raw.concerns) ? raw.concerns.filter((x): x is SkinMetricKey => KEYS.includes(x as SkinMetricKey)) : [],
    topOpportunities: Array.isArray(raw.topOpportunities) ? raw.topOpportunities.filter((x): x is SkinMetricKey => KEYS.includes(x as SkinMetricKey)) : [],
    confidence: Math.max(0.35, Math.min(0.98, Number(raw.confidence ?? 0.6))),
    provider: raw.provider || 'local-ai',
    providerUsed: (raw as any).providerUsed || raw.provider || 'local-ai',
    metricsSource: (raw as any).metricsSource || undefined,
    createdAt: raw.createdAt || new Date().toISOString(),
    imageQuality: raw.imageQuality,
    observations: Array.isArray(raw.observations) ? raw.observations : [],
    limitations: Array.isArray(raw.limitations) ? raw.limitations : [],
    recommendedNextStep: raw.recommendedNextStep,
    apparentSkinAge: Number.isFinite(Number((raw as any).apparentSkinAge))
      ? Math.max(18, Math.min(70, Math.round(Number((raw as any).apparentSkinAge))))
      : undefined,
    apparentSkinAgeNote: typeof (raw as any).apparentSkinAgeNote === 'string'
      ? (raw as any).apparentSkinAgeNote
      : undefined,
  };
}

export const skinAnalysisService = {
  provider: 'local-yolo-acne',
  async checkImageQuality(imageDataUrl: string): Promise<ImageQualityResult> {
    // Fast local pixel gate first
    try {
      const stats = await analyzePixels(imageDataUrl);
      const issues: { code: string; message: string }[] = [];
      if (stats.width < 400 || stats.height < 400) issues.push({ code: 'low_resolution', message: 'رزولوشن تصویر پایین است.' });
      if (stats.meanBrightness < 55) issues.push({ code: 'too_dark', message: 'نور تصویر کم است.' });
      if (stats.meanBrightness > 225) issues.push({ code: 'too_bright', message: 'نور تصویر بیش از حد زیاد است.' });
      if (stats.contrast < 8) issues.push({ code: 'low_contrast', message: 'کنتراست تصویر پایین است.' });
      if (stats.sharpness < 2) issues.push({ code: 'blurry', message: 'تصویر ممکن است تار باشد.' });
      if (issues.length) return { ok: false, issues };
    } catch {
      return { ok: false, issues: [{ code: 'invalid_image', message: 'خواندن تصویر ممکن نیست.' }] };
    }

    // Server face + quality gate (MediaPipe/Haar) — before any analysis model
    try {
      const { deviceLicenseService } = await import('./deviceLicenseService');
      const response = await fetch('/api/image-quality', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...deviceLicenseService.authHeaders() },
        body: JSON.stringify({ imageDataUrl }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body.ok === false) {
        const msg = body.error
          || (Array.isArray(body.imageQuality?.issues) ? body.imageQuality.issues[0] : null)
          || 'چهره یا کیفیت تصویر برای تحلیل مناسب نیست.';
        return { ok: false, issues: [{ code: 'face_quality', message: msg }] };
      }
      return { ok: true, issues: [] };
    } catch {
      // If AI server is down, keep local pixel OK so UX isn't blocked offline —
      // server /api/skin-analysis still re-checks before models.
      return { ok: true, issues: [] };
    }
  },
  async analyzeSkin(
    imageDataUrl: string,
    _profile: SkinProfile,
    mode: 'accurate' | 'standard' = 'standard',
    opts?: { sessionId?: string; scanId?: string; phone?: string; chronologicalAge?: number },
  ): Promise<SkinAnalysisResult> {
    const quality = await this.checkImageQuality(imageDataUrl);
    if (!quality.ok) throw new Error(quality.issues[0]?.message || 'این عکس برای تحلیل مناسب نیست.');
    try {
      const { deviceLicenseService } = await import('./deviceLicenseService');
      const response = await fetch('/api/skin-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...deviceLicenseService.authHeaders() },
        body: JSON.stringify({
          imageDataUrl,
          mode,
          session_id: opts?.sessionId,
          scan_id: opts?.scanId,
          phone: opts?.phone,
          chronologicalAge: opts?.chronologicalAge,
          age: opts?.chronologicalAge,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          const { clearDeviceAuth } = await import('./deviceLicenseService');
          clearDeviceAuth();
        }
        const issues = Array.isArray((body as { imageQuality?: { issues?: string[] } }).imageQuality?.issues)
          ? (body as { imageQuality: { issues: string[] } }).imageQuality.issues
          : [];
        throw new Error(body?.error || issues[0] || `تحلیل پوست ناموفق بود (${response.status}).`);
      }
      const validated = validateProviderResult(body);
      (validated as any).scanId = body.scanId || body.scan_id;
      return validated;
    } catch (error) {
      throw error instanceof Error ? error : new Error('ارتباط با سرویس AI برقرار نشد.');
    }
  },
};
