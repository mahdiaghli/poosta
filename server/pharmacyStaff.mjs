import { getDb, newId, nowIso, hashToken, hashPin, randomToken } from './db.mjs';

const STAFF_TTL_MS = 12 * 60 * 60 * 1000;

export function staffLogin({ code, pin }) {
  const pharmacy = getDb().prepare(
    'SELECT * FROM pharmacies WHERE lower(code) = lower(?) AND status = ?',
  ).get(String(code || '').trim(), 'active');
  if (!pharmacy || !pharmacy.pin_hash || pharmacy.pin_hash !== hashPin(pin)) {
    const err = new Error('کد داروخانه یا رمز ورود نادرست است.');
    err.code = 'STAFF_AUTH_FAILED';
    err.status = 401;
    throw err;
  }
  const token = randomToken();
  const expiresAt = new Date(Date.now() + STAFF_TTL_MS).toISOString();
  getDb().prepare('DELETE FROM staff_tokens WHERE pharmacy_id = ?').run(pharmacy.id);
  getDb().prepare(`
    INSERT INTO staff_tokens (id, pharmacy_id, token_hash, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(newId('stok'), pharmacy.id, hashToken(token), expiresAt);
  return {
    token,
    expires_at: expiresAt,
    pharmacy: { id: pharmacy.id, name: pharmacy.name, code: pharmacy.code, city: pharmacy.city },
  };
}

export function requireStaff(req) {
  const token = req.headers['x-poosta-staff-token'] || req.headers['X-Poosta-Staff-Token'];
  if (!token) {
    const err = new Error('ورود پرسنل لازم است.');
    err.code = 'STAFF_REQUIRED';
    err.status = 401;
    throw err;
  }
  const row = getDb().prepare(`
    SELECT t.*, p.name AS pharmacy_name, p.code AS pharmacy_code
    FROM staff_tokens t
    JOIN pharmacies p ON p.id = t.pharmacy_id
    WHERE t.token_hash = ?
  `).get(hashToken(token));
  if (!row || new Date(row.expires_at).getTime() < Date.now()) {
    const err = new Error('نشست پرسنل منقضی شده است.');
    err.code = 'STAFF_EXPIRED';
    err.status = 401;
    throw err;
  }
  return row;
}

function summarizeScan(row) {
  const result = row.customer_result_json ? JSON.parse(row.customer_result_json) : null;
  const recommendations = row.recommendations_json ? JSON.parse(row.recommendations_json) : [];
  const routine = row.routine_json ? JSON.parse(row.routine_json) : null;
  return {
    scan_id: row.id,
    created_at: row.created_at,
    status: row.status,
    mode: row.mode,
    device_id: row.device_id,
    customer_id: row.customer_id,
    phone: row.phone || null,
    overallScore: result?.overallScore ?? null,
    metrics: result?.metrics ?? null,
    concerns: result?.concerns ?? [],
    recommendations: Array.isArray(recommendations) ? recommendations.slice(0, 12) : [],
    routine,
  };
}

export function listTodayScans(pharmacyId, { since } = {}) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const params = [pharmacyId, start.toISOString()];
  let sql = `
    SELECT s.*, c.phone
    FROM scans s
    LEFT JOIN customers c ON c.id = s.customer_id
    WHERE s.pharmacy_id = ? AND s.created_at >= ?
      AND s.status LIKE 'completed%'
  `;
  if (since) {
    sql += ' AND s.created_at > ?';
    params.push(since);
  }
  sql += ' ORDER BY s.created_at DESC LIMIT 100';
  return getDb().prepare(sql).all(...params).map(summarizeScan);
}

export function getScanDetailForPharmacy(pharmacyId, scanId) {
  const row = getDb().prepare(`
    SELECT s.*, c.phone, c.display_name
    FROM scans s
    LEFT JOIN customers c ON c.id = s.customer_id
    WHERE s.id = ? AND s.pharmacy_id = ?
  `).get(scanId, pharmacyId);
  if (!row) return null;
  return {
    ...summarizeScan(row),
    display_name: row.display_name || null,
    result: row.customer_result_json ? JSON.parse(row.customer_result_json) : null,
  };
}

export function attachScanExtras(scanId, { recommendations, routine, customerId }) {
  const db = getDb();
  const scan = db.prepare('SELECT * FROM scans WHERE id = ?').get(scanId);
  if (!scan) return;
  db.prepare(`
    UPDATE scans SET
      recommendations_json = COALESCE(?, recommendations_json),
      routine_json = COALESCE(?, routine_json),
      customer_id = COALESCE(?, customer_id)
    WHERE id = ?
  `).run(
    recommendations ? JSON.stringify(recommendations) : null,
    routine ? JSON.stringify(routine) : null,
    customerId || null,
    scanId,
  );
}
