import { deviceLicenseService } from './deviceLicenseService';
import type { Routine } from '@/types';

export type ShareRoutineResult = {
  share_id: string;
  token: string;
  url: string;
  expires_at: string;
  sms: { sent: boolean; mocked: boolean; provider: string; to: string };
};

export const routineShareService = {
  async sendRoutineSms(phone: string, routine: Routine, overallScore?: number, scanId?: string | null): Promise<ShareRoutineResult> {
    const res = await fetch('/api/routines/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...deviceLicenseService.authHeaders() },
      body: JSON.stringify({ phone, routine, overallScore, send_sms: true, scan_id: scanId }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || body.code || 'ارسال روتین ناموفق بود.');
    return body as ShareRoutineResult;
  },

  async getShared(token: string) {
    const res = await fetch(`/api/routines/shared/${encodeURIComponent(token)}`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'خواندن روتین ناموفق بود.');
    return body;
  },
};
