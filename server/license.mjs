import { getDb, newId, nowIso, hashToken, randomToken } from './db.mjs';

const GRACE_DAYS = Number(process.env.POOSTA_SUBSCRIPTION_GRACE_DAYS || 3);
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export function licenseRequired() {
  return String(process.env.POOSTA_LICENSE_REQUIRED || 'false').toLowerCase() === 'true';
}

function featuresForPlan(planId) {
  const rows = getDb().prepare(
    'SELECT feature_key, enabled FROM plan_features WHERE plan_id = ?',
  ).all(planId);
  const out = {};
  for (const r of rows) out[r.feature_key] = Boolean(r.enabled);
  return out;
}

function activeSubscription(pharmacyId) {
  const sub = getDb().prepare(`
    SELECT s.*, p.name AS plan_name, p.max_devices
    FROM subscriptions s
    JOIN plans p ON p.id = s.plan_id
    WHERE s.pharmacy_id = ? AND s.status = 'active'
    ORDER BY s.expires_at DESC
    LIMIT 1
  `).get(pharmacyId);
  if (!sub) return null;
  const expires = new Date(sub.expires_at).getTime();
  const graceEnd = expires + GRACE_DAYS * 24 * 60 * 60 * 1000;
  if (Date.now() > graceEnd) return { ...sub, expired: true };
  return { ...sub, expired: false, inGrace: Date.now() > expires };
}

export function issueToken(deviceId) {
  const database = getDb();
  const token = randomToken();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
  database.prepare('DELETE FROM device_tokens WHERE device_id = ?').run(deviceId);
  database.prepare(`
    INSERT INTO device_tokens (id, device_id, token_hash, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(newId('tok'), deviceId, hashToken(token), expiresAt);
  return { token, expiresAt };
}

export function activateDevice({ activationCode, appVersion }) {
  const database = getDb();
  const code = String(activationCode || '').trim().toUpperCase();
  const device = database.prepare('SELECT * FROM devices WHERE activation_code = ?').get(code);
  if (!device) {
    const err = new Error('کد فعال‌سازی نامعتبر است.');
    err.code = 'DEVICE_NOT_ACTIVATED';
    err.status = 404;
    throw err;
  }
  if (device.status === 'revoked') {
    const err = new Error('این دستگاه لغو شده است.');
    err.code = 'LICENSE_REVOKED';
    err.status = 403;
    throw err;
  }

  const sub = activeSubscription(device.pharmacy_id);
  if (!sub || sub.expired) {
    const err = new Error('اشتراک این داروخانه منقضی شده است.');
    err.code = 'SUBSCRIPTION_EXPIRED';
    err.status = 403;
    throw err;
  }

  if (device.status !== 'active') {
    const activeCount = database.prepare(
      `SELECT COUNT(*) AS c FROM devices WHERE pharmacy_id = ? AND status = 'active'`,
    ).get(device.pharmacy_id).c;
    if (activeCount >= sub.max_devices) {
      const err = new Error('سقف تعداد دستگاه‌های این اشتراک پر شده است.');
      err.code = 'DEVICE_LIMIT_REACHED';
      err.status = 403;
      throw err;
    }
    database.prepare(`
      UPDATE devices SET status = 'active', registered_at = ?, app_version = ?, last_seen = ?
      WHERE id = ?
    `).run(nowIso(), appVersion || null, nowIso(), device.id);
  } else {
    database.prepare('UPDATE devices SET app_version = ?, last_seen = ? WHERE id = ?')
      .run(appVersion || null, nowIso(), device.id);
  }

  const { token, expiresAt } = issueToken(device.id);
  return {
    device_id: device.id,
    device_code: device.device_code,
    pharmacy_id: device.pharmacy_id,
    token,
    expires_at: expiresAt,
    license: licenseStatusForPharmacy(device.pharmacy_id, sub),
  };
}

export function licenseStatusForPharmacy(pharmacyId, sub = null) {
  const subscription = sub || activeSubscription(pharmacyId);
  if (!subscription) {
    return { status: 'none', features: {} };
  }
  const pharmacy = getDb().prepare('SELECT id, name, status FROM pharmacies WHERE id = ?').get(pharmacyId);
  return {
    status: subscription.expired ? 'expired' : (subscription.inGrace ? 'grace' : 'active'),
    plan: subscription.plan_name,
    plan_id: subscription.plan_id,
    pharmacy: pharmacy ? { id: pharmacy.id, name: pharmacy.name, status: pharmacy.status } : null,
    started_at: subscription.started_at,
    expires_at: subscription.expires_at,
    max_devices: subscription.max_devices,
    features: featuresForPlan(subscription.plan_id),
    in_grace: Boolean(subscription.inGrace),
  };
}

export function verifyDeviceToken(rawToken) {
  if (!rawToken) return null;
  const tokenHash = hashToken(rawToken);
  const row = getDb().prepare(`
    SELECT t.*, d.pharmacy_id, d.status AS device_status, d.device_code, d.app_version
    FROM device_tokens t
    JOIN devices d ON d.id = t.device_id
    WHERE t.token_hash = ?
  `).get(tokenHash);
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  if (row.device_status === 'revoked') return null;
  return row;
}

export function heartbeat(deviceRow, appVersion) {
  const sub = activeSubscription(deviceRow.pharmacy_id);
  if (!sub || sub.expired) {
    const err = new Error('اشتراک منقضی شده است.');
    err.code = 'SUBSCRIPTION_EXPIRED';
    err.status = 403;
    throw err;
  }
  if (deviceRow.device_status === 'revoked') {
    const err = new Error('دستگاه لغو شده است.');
    err.code = 'LICENSE_REVOKED';
    err.status = 403;
    throw err;
  }
  getDb().prepare('UPDATE devices SET last_seen = ?, app_version = COALESCE(?, app_version) WHERE id = ?')
    .run(nowIso(), appVersion || null, deviceRow.device_id);
  const { token, expiresAt } = issueToken(deviceRow.device_id);
  return {
    token,
    expires_at: expiresAt,
    license: licenseStatusForPharmacy(deviceRow.pharmacy_id, sub),
  };
}

export function assertFeature(license, featureKey) {
  if (!license?.features?.[featureKey]) {
    const err = new Error('این قابلیت در اشتراک شما فعال نیست.');
    err.code = 'FEATURE_DISABLED';
    err.status = 403;
    throw err;
  }
}

export function requireDevice(req) {
  const header = req.headers.authorization || req.headers.Authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  const token = match?.[1]?.trim();
  const device = verifyDeviceToken(token);
  if (!device) {
    const err = new Error('توکن دستگاه نامعتبر یا منقضی است.');
    err.code = 'INVALID_TOKEN';
    err.status = 401;
    throw err;
  }
  if (device.device_status === 'revoked') {
    const err = new Error('دستگاه لغو شده است.');
    err.code = 'LICENSE_REVOKED';
    err.status = 403;
    throw err;
  }
  const sub = activeSubscription(device.pharmacy_id);
  if (!sub || sub.expired) {
    const err = new Error('اشتراک منقضی شده است.');
    err.code = 'SUBSCRIPTION_EXPIRED';
    err.status = 403;
    throw err;
  }
  return {
    device,
    license: licenseStatusForPharmacy(device.pharmacy_id, sub),
  };
}

/** Optional auth: required only when POOSTA_LICENSE_REQUIRED=true */
export function optionalDevice(req) {
  if (!licenseRequired()) {
    try {
      return requireDevice(req);
    } catch {
      return {
        device: {
          device_id: 'dev_local',
          pharmacy_id: 'local-dev',
          device_status: 'active',
          device_code: 'LOCAL',
        },
        license: {
          status: 'active',
          plan: 'dev',
          features: {
            skin_analysis: true,
            accurate_analysis: true,
            product_recommendation: true,
            routine_sms: true,
            advanced_analysis: true,
            multi_device: true,
          },
        },
        legacy: true,
      };
    }
  }
  return requireDevice(req);
}
