import crypto from 'node:crypto';
import { getDb, newId, nowIso } from './db.mjs';
import { sendSms } from './sms.mjs';
import { upsertCustomer } from './customers.mjs';

const SHARE_TTL_DAYS = Number(process.env.POOSTA_ROUTINE_SHARE_DAYS || 30);

function publicBaseUrl() {
  return (process.env.POOSTA_PUBLIC_BASE_URL || 'http://127.0.0.1:5173').replace(/\/$/, '');
}

function buildWeeklyView(routine) {
  const DAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
  if (!routine) return [];
  return DAYS.map((day) => ({
    day,
    morning: (routine.morning || []).filter((s) => !s.schedule?.length || s.schedule.includes(day))
      .map((s) => ({ name: s.name, productName: s.productName, frequency: s.frequency })),
    night: (routine.night || []).filter((s) => !s.schedule?.length || s.schedule.includes(day))
      .map((s) => ({ name: s.name, productName: s.productName, frequency: s.frequency })),
  }));
}

export async function createAndSendRoutineShare({
  pharmacyId,
  deviceId,
  phone,
  routine,
  overallScore,
  sendSmsFlag = true,
  scanId,
}) {
  if (!routine?.morning && !routine?.night) {
    const err = new Error('روتینی برای ارسال وجود ندارد.');
    err.code = 'NO_ROUTINE';
    err.status = 400;
    throw err;
  }

  const customer = upsertCustomer({ pharmacyId, phone });
  if (scanId) {
    getDb().prepare('UPDATE scans SET customer_id = COALESCE(customer_id, ?) WHERE id = ?')
      .run(customer.id, scanId);
  }

  const normalized = customer.phone;
  const token = crypto.randomBytes(16).toString('base64url');
  const id = newId('share');
  const created = nowIso();
  const expires = new Date(Date.now() + SHARE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const payload = {
    version: 1,
    overallScore: overallScore ?? null,
    routine: {
      morning: routine.morning || [],
      night: routine.night || [],
      conflicts: routine.conflicts || [],
      variant: routine.variant,
    },
    weekly: buildWeeklyView(routine),
    created_at: created,
  };

  getDb().prepare(`
    INSERT INTO shared_routines (
      id, token, pharmacy_id, device_id, phone, customer_id, payload_json, sms_status, created_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
  `).run(id, token, pharmacyId, deviceId || null, normalized, customer.id, JSON.stringify(payload), created, expires);

  const link = `${publicBaseUrl()}/r/${token}`;
  const message = `پوستا — روتین مراقبت پوست شما آماده است.\nمشاهده روزانه و هفتگی:\n${link}\n(لینک تا ${SHARE_TTL_DAYS} روز معتبر است)`;

  let smsResult = { ok: true, mocked: true, provider: 'skipped' };
  if (sendSmsFlag) {
    try {
      smsResult = await sendSms({ to: normalized, message });
      getDb().prepare(`UPDATE shared_routines SET sms_status = ? WHERE id = ?`)
        .run(smsResult.mocked ? 'logged' : 'sent', id);
    } catch (e) {
      getDb().prepare(`UPDATE shared_routines SET sms_status = ? WHERE id = ?`)
        .run(`failed:${e.message}`.slice(0, 120), id);
      throw e;
    }
  }

  return {
    share_id: id,
    token,
    url: link,
    expires_at: expires,
    customer_id: customer.id,
    sms: {
      sent: Boolean(smsResult.ok) && !smsResult.mocked,
      mocked: Boolean(smsResult.mocked),
      provider: smsResult.provider,
      to: normalized,
    },
  };
}

export function getSharedRoutine(token) {
  const row = getDb().prepare('SELECT * FROM shared_routines WHERE token = ?').get(token);
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return { expired: true };
  }
  return {
    expired: false,
    created_at: row.created_at,
    expires_at: row.expires_at,
    ...JSON.parse(row.payload_json),
  };
}
