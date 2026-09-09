const buckets = new Map();

export function assertRateLimit(req, scope, { limit, windowMs }, identity = '') {
  const ip = req.socket?.remoteAddress || 'unknown';
  const key = `${scope}:${ip}:${String(identity || '').toLowerCase()}`;
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  current.count += 1;
  if (current.count <= limit) return;

  const err = new Error('درخواست‌های زیادی ارسال شده است. کمی بعد دوباره تلاش کنید.');
  err.status = 429;
  err.code = 'RATE_LIMITED';
  err.retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
  throw err;
}
