/**
 * SMS sender — Kavenegar when configured; otherwise logs the message (dev).
 */
export function normalizeIranMobile(phone) {
  let p = String(phone || '').trim().replace(/[\s-]/g, '');
  if (p.startsWith('0098')) p = `+${p.slice(2)}`;
  if (p.startsWith('98') && p.length >= 12) p = `+${p}`;
  if (p.startsWith('09') && p.length === 11) p = `+98${p.slice(1)}`;
  if (p.startsWith('+989') && p.length === 13) return p;
  return null;
}

/** Kavenegar expects 09xxxxxxxxx */
export function toKavenegarReceptor(e164) {
  if (!e164?.startsWith('+98')) return null;
  return `0${e164.slice(3)}`;
}

export async function sendSms({ to, message }) {
  const normalized = normalizeIranMobile(to);
  if (!normalized) {
    const err = new Error('شماره موبایل معتبر نیست (مثال: 0912…).');
    err.code = 'INVALID_PHONE';
    err.status = 400;
    throw err;
  }

  const apiKey = process.env.KAVENEGAR_API_KEY || '';
  const sender = process.env.KAVENEGAR_SENDER || '';

  if (!apiKey) {
    console.log('[sms:dev] no KAVENEGAR_API_KEY — message not sent:');
    console.log(`  to=${normalized}`);
    console.log(`  text=${message}`);
    return { ok: true, provider: 'console', to: normalized, mocked: true };
  }

  const receptor = toKavenegarReceptor(normalized);
  const url = `https://api.kavenegar.com/v1/${apiKey}/sms/send.json`;
  const params = new URLSearchParams({
    receptor,
    message,
    ...(sender ? { sender } : {}),
  });

  const res = await fetch(`${url}?${params.toString()}`, { method: 'GET' });
  const body = await res.json().catch(() => ({}));
  const status = body?.return?.status;
  if (!res.ok || (status != null && status !== 200)) {
    const err = new Error(body?.return?.message || 'ارسال پیامک ناموفق بود.');
    err.code = 'SMS_FAILED';
    err.status = 502;
    throw err;
  }
  return { ok: true, provider: 'kavenegar', to: normalized, mocked: false, raw: body };
}
