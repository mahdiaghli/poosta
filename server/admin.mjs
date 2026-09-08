import { getDb, newId, nowIso, hashPin, randomActivationCode } from './db.mjs';

export function requireAdmin(req) {
  const key = process.env.POOSTA_ADMIN_KEY || '';
  const provided = req.headers['x-poosta-admin-key'] || req.headers['X-Poosta-Admin-Key'];
  if (!key || provided !== key) {
    const err = new Error('دسترسی ادمین مجاز نیست.');
    err.code = 'ADMIN_FORBIDDEN';
    err.status = 403;
    throw err;
  }
}

export function adminCreatePharmacy({ name, city, code, pin, plan = 'basic', years = 1 }) {
  const db = getDb();
  const pharmacyCode = String(code || '').trim().toUpperCase();
  if (!name || !pharmacyCode || !pin) {
    const err = new Error('name، code و pin الزامی است.');
    err.status = 400;
    throw err;
  }
  if (db.prepare('SELECT id FROM pharmacies WHERE lower(code) = lower(?)').get(pharmacyCode)) {
    const err = new Error('این کد داروخانه قبلاً استفاده شده.');
    err.status = 409;
    throw err;
  }
  const id = newId('pharmacy');
  db.prepare(`
    INSERT INTO pharmacies (id, name, city, status, created_at, code, pin_hash)
    VALUES (?, ?, ?, 'active', ?, ?, ?)
  `).run(id, name, city || null, nowIso(), pharmacyCode, hashPin(pin));

  const planId = plan === 'pro' ? 'plan_pro' : 'plan_basic';
  const started = new Date();
  const expires = new Date(started);
  expires.setFullYear(expires.getFullYear() + Number(years || 1));
  db.prepare(`
    INSERT INTO subscriptions (id, pharmacy_id, plan_id, started_at, expires_at, status)
    VALUES (?, ?, ?, ?, ?, 'active')
  `).run(newId('sub'), id, planId, started.toISOString(), expires.toISOString());

  const activation = randomActivationCode();
  const deviceId = newId('device');
  db.prepare(`
    INSERT INTO devices (id, pharmacy_id, device_code, activation_code, status, registered_at)
    VALUES (?, ?, 'TABLET-001', ?, 'pending', ?)
  `).run(deviceId, id, activation, nowIso());

  return {
    pharmacy: { id, name, code: pharmacyCode, city },
    plan: planId,
    expires_at: expires.toISOString(),
    device_activation_code: activation,
  };
}

export function adminRevokeDevice(deviceId) {
  const db = getDb();
  const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(deviceId);
  if (!device) {
    const err = new Error('دستگاه پیدا نشد.');
    err.status = 404;
    throw err;
  }
  db.prepare(`UPDATE devices SET status = 'revoked' WHERE id = ?`).run(deviceId);
  db.prepare(`DELETE FROM device_tokens WHERE device_id = ?`).run(deviceId);
  return { ok: true, device_id: deviceId };
}

export function adminRenewSubscription({ pharmacyId, plan, years = 1 }) {
  const db = getDb();
  const pharmacy = db.prepare('SELECT * FROM pharmacies WHERE id = ?').get(pharmacyId);
  if (!pharmacy) {
    const err = new Error('داروخانه پیدا نشد.');
    err.status = 404;
    throw err;
  }
  db.prepare(`UPDATE subscriptions SET status = 'replaced' WHERE pharmacy_id = ? AND status = 'active'`)
    .run(pharmacyId);
  const planId = plan === 'pro' ? 'plan_pro' : (plan === 'basic' ? 'plan_basic' : plan || 'plan_basic');
  const started = new Date();
  const expires = new Date(started);
  expires.setFullYear(expires.getFullYear() + Number(years || 1));
  const id = newId('sub');
  db.prepare(`
    INSERT INTO subscriptions (id, pharmacy_id, plan_id, started_at, expires_at, status)
    VALUES (?, ?, ?, ?, ?, 'active')
  `).run(id, pharmacyId, planId, started.toISOString(), expires.toISOString());
  return { subscription_id: id, plan_id: planId, expires_at: expires.toISOString() };
}

export function adminListPharmacies() {
  return getDb().prepare(`
    SELECT p.id, p.name, p.code, p.city, p.status,
      (SELECT expires_at FROM subscriptions s WHERE s.pharmacy_id = p.id AND s.status = 'active' ORDER BY expires_at DESC LIMIT 1) AS expires_at,
      (SELECT COUNT(*) FROM devices d WHERE d.pharmacy_id = p.id AND d.status = 'active') AS active_devices
    FROM pharmacies p
    ORDER BY p.created_at DESC
  `).all();
}

export function adminListDevices(pharmacyId) {
  return getDb().prepare(`
    SELECT id, device_code, activation_code, status, last_seen, app_version, registered_at
    FROM devices WHERE pharmacy_id = ? ORDER BY registered_at DESC
  `).all(pharmacyId);
}
