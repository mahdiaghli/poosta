import { getDb, newId, nowIso } from './db.mjs';
import { normalizeIranMobile } from './sms.mjs';

export function upsertCustomer({ pharmacyId, phone, displayName }) {
  const normalized = normalizeIranMobile(phone);
  if (!normalized) {
    const err = new Error('شماره موبایل معتبر نیست.');
    err.code = 'INVALID_PHONE';
    err.status = 400;
    throw err;
  }
  const db = getDb();
  const existing = db.prepare(
    'SELECT * FROM customers WHERE pharmacy_id = ? AND phone = ?',
  ).get(pharmacyId, normalized);
  if (existing) {
    db.prepare('UPDATE customers SET last_seen_at = ?, display_name = COALESCE(?, display_name) WHERE id = ?')
      .run(nowIso(), displayName || null, existing.id);
    return db.prepare('SELECT * FROM customers WHERE id = ?').get(existing.id);
  }
  const id = newId('cust');
  db.prepare(`
    INSERT INTO customers (id, pharmacy_id, phone, display_name, created_at, last_seen_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, pharmacyId, normalized, displayName || null, nowIso(), nowIso());
  return db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
}

export function getCustomerProgress(pharmacyId, phone) {
  const normalized = normalizeIranMobile(phone);
  if (!normalized) return null;
  const customer = getDb().prepare(
    'SELECT * FROM customers WHERE pharmacy_id = ? AND phone = ?',
  ).get(pharmacyId, normalized);
  if (!customer) return { customer: null, scans: [], progress: null };

  const scans = getDb().prepare(`
    SELECT id, created_at, status, mode, customer_result_json, recommendations_json, routine_json
    FROM scans
    WHERE pharmacy_id = ? AND customer_id = ? AND status LIKE 'completed%'
    ORDER BY created_at DESC
    LIMIT 20
  `).all(pharmacyId, customer.id);

  const parsed = scans.map((s) => ({
    scan_id: s.id,
    created_at: s.created_at,
    mode: s.mode,
    result: s.customer_result_json ? JSON.parse(s.customer_result_json) : null,
    recommendations: s.recommendations_json ? JSON.parse(s.recommendations_json) : [],
    routine: s.routine_json ? JSON.parse(s.routine_json) : null,
  }));

  let progress = null;
  if (parsed.length >= 2 && parsed[0].result && parsed[1].result) {
    const latest = parsed[0].result;
    const prev = parsed[1].result;
    const metricDiffs = {};
    const keys = Object.keys(latest.metrics || {});
    for (const k of keys) {
      metricDiffs[k] = Number(latest.metrics[k]) - Number(prev.metrics?.[k] ?? latest.metrics[k]);
    }
    progress = {
      prev_scan_id: parsed[1].scan_id,
      latest_scan_id: parsed[0].scan_id,
      prev_overall: prev.overallScore,
      latest_overall: latest.overallScore,
      overall_diff: latest.overallScore - prev.overallScore,
      metric_diffs: metricDiffs,
      days_between: Math.round(
        (new Date(parsed[0].created_at) - new Date(parsed[1].created_at)) / (24 * 3600 * 1000),
      ),
    };
  }

  return { customer, scans: parsed, progress };
}
