import fs from 'node:fs';
import { getDb, newId, nowIso } from './db.mjs';
import { recordAuditEvent } from './audit.mjs';

function parseJson(value, fallback) {
  try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
}

function rangeStart(range) {
  const start = new Date();
  if (range === 'today') start.setHours(0, 0, 0, 0);
  else if (range === 'week') start.setDate(start.getDate() - 7);
  else if (range === 'month') start.setMonth(start.getMonth() - 1);
  else {
    const err = new Error('بازه گزارش باید today، week یا month باشد.');
    err.status = 400;
    err.code = 'INVALID_RANGE';
    throw err;
  }
  return start.toISOString();
}

function topCounts(map, limit = 6) {
  return Array.from(map.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function getPharmacyAnalytics(pharmacyId, range = 'today') {
  const db = getDb();
  const since = rangeStart(range);
  const scans = db.prepare(`
    SELECT id, mode, customer_id, customer_result_json, recommendations_json
    FROM scans
    WHERE pharmacy_id = ? AND created_at >= ? AND status LIKE 'completed%'
  `).all(pharmacyId, since);

  const concerns = new Map();
  const products = new Map();
  const modes = {};
  let scoreTotal = 0;
  let scoreCount = 0;
  for (const scan of scans) {
    const result = parseJson(scan.customer_result_json, {});
    const recommendations = parseJson(scan.recommendations_json, []);
    if (Number.isFinite(Number(result.overallScore))) {
      scoreTotal += Number(result.overallScore);
      scoreCount += 1;
    }
    modes[scan.mode || 'standard'] = (modes[scan.mode || 'standard'] || 0) + 1;
    for (const concern of Array.isArray(result.concerns) ? result.concerns : []) {
      const key = typeof concern === 'string' ? concern : concern?.name || concern?.key;
      if (key) concerns.set(key, (concerns.get(key) || 0) + 1);
    }
    for (const product of Array.isArray(recommendations) ? recommendations : []) {
      const key = product?.name || product?.id;
      if (key) products.set(key, (products.get(key) || 0) + 1);
    }
  }

  const actionCounts = Object.fromEntries(db.prepare(`
    SELECT action, COUNT(*) AS count
    FROM scan_staff_actions
    WHERE pharmacy_id = ? AND created_at >= ?
    GROUP BY action
  `).all(pharmacyId, since).map((row) => [row.action, row.count]));
  const routineSent = db.prepare(`
    SELECT COUNT(*) AS count FROM shared_routines WHERE pharmacy_id = ? AND created_at >= ?
  `).get(pharmacyId, since).count;
  const returningCustomers = db.prepare(`
    SELECT COUNT(*) AS count FROM (
      SELECT customer_id FROM scans
      WHERE pharmacy_id = ? AND customer_id IS NOT NULL AND status LIKE 'completed%'
      GROUP BY customer_id HAVING COUNT(*) >= 2
    )
  `).get(pharmacyId).count;
  const lowStock = db.prepare(`
    SELECT COUNT(*) AS count FROM pharmacy_products
    WHERE pharmacy_id = ? AND available = 1 AND stock <= COALESCE(low_stock_threshold, 3)
  `).get(pharmacyId).count;

  return {
    range,
    since,
    scan_count: scans.length,
    average_score: scoreCount ? Math.round(scoreTotal / scoreCount) : null,
    routine_sent_count: routineSent,
    print_count: actionCounts.print || 0,
    completed_visit_count: actionCounts.complete_visit || 0,
    follow_up_count: actionCounts.follow_up || 0,
    returning_customers: returningCustomers,
    low_stock_count: lowStock,
    modes,
    top_concerns: topCounts(concerns),
    top_recommended_products: topCounts(products),
  };
}

export function searchPharmacyCustomers(pharmacyId, phone = '') {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 3) {
    const err = new Error('حداقل سه رقم از شماره موبایل را وارد کنید.');
    err.status = 400;
    err.code = 'INVALID_PHONE_QUERY';
    throw err;
  }
  return getDb().prepare(`
    SELECT c.id, c.phone, c.display_name, c.created_at, c.last_seen_at,
      COUNT(s.id) AS scan_count,
      MAX(s.created_at) AS latest_scan_at
    FROM customers c
    LEFT JOIN scans s ON s.customer_id = c.id AND s.status LIKE 'completed%'
    WHERE c.pharmacy_id = ? AND REPLACE(c.phone, '+', '') LIKE ?
    GROUP BY c.id
    ORDER BY c.last_seen_at DESC
    LIMIT 25
  `).all(pharmacyId, `%${digits}%`);
}

const catalogPath = new URL('../src/data/productCatalog.json', import.meta.url);
let catalogCache;
function catalog() {
  if (catalogCache) return catalogCache;
  try {
    const parsed = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    catalogCache = Array.isArray(parsed.products) ? parsed.products : [];
  } catch {
    catalogCache = [];
  }
  return catalogCache;
}

export function searchCatalog(pharmacyId, query = '') {
  const q = String(query || '').trim().toLowerCase();
  if (q.length < 2) return [];
  const inventory = new Map(getDb().prepare(`
    SELECT * FROM pharmacy_products WHERE pharmacy_id = ?
  `).all(pharmacyId).map((row) => [row.product_id, row]));
  return catalog()
    .filter((p) => [p.id, p.name, p.brand, p.barcode].some((v) => String(v || '').toLowerCase().includes(q)))
    .slice(0, 20)
    .map((p) => {
      const stocked = inventory.get(p.id);
      return {
        id: p.id,
        name: p.name,
        brand: p.brand,
        category: p.category,
        barcode: p.barcode || null,
        inventory: stocked ? {
          price: stocked.price,
          currency: stocked.currency,
          stock: stocked.stock,
          available: Boolean(stocked.available),
          sku: stocked.sku,
          low_stock_threshold: stocked.low_stock_threshold ?? 3,
        } : null,
      };
    });
}

const ACTIONS = new Set(['phone_saved', 'routine_sent', 'print', 'share', 'follow_up', 'complete_visit', 'note']);

export function recordScanStaffAction({ pharmacyId, staffTokenId, scanId, action, note }) {
  if (!ACTIONS.has(action)) {
    const err = new Error('عملیات ثبت‌شده معتبر نیست.');
    err.status = 400;
    err.code = 'INVALID_SCAN_ACTION';
    throw err;
  }
  const db = getDb();
  const scan = db.prepare(`
    SELECT id, customer_id FROM scans WHERE id = ? AND pharmacy_id = ?
  `).get(scanId, pharmacyId);
  if (!scan) {
    const err = new Error('اسکن پیدا نشد.');
    err.status = 404;
    err.code = 'SCAN_NOT_FOUND';
    throw err;
  }
  const cleanNote = String(note || '').trim().slice(0, 1000) || null;
  const createdAt = nowIso();
  const id = newId('action');
  db.prepare(`
    INSERT INTO scan_staff_actions (id, pharmacy_id, scan_id, staff_token_id, action, note, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, pharmacyId, scanId, staffTokenId || null, action, cleanNote, createdAt);
  if (cleanNote && scan.customer_id) {
    db.prepare(`
      INSERT INTO customer_notes (id, pharmacy_id, customer_id, scan_id, note, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(newId('note'), pharmacyId, scan.customer_id, scanId, cleanNote, createdAt);
  }
  recordAuditEvent({
    pharmacyId,
    actorType: 'staff',
    actorId: staffTokenId,
    eventType: `scan.${action}`,
    entityType: 'scan',
    entityId: scanId,
    metadata: cleanNote ? { note: cleanNote } : {},
  });
  return getScanChecklist(pharmacyId, scanId);
}

export function getScanChecklist(pharmacyId, scanId) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT action, note, created_at FROM scan_staff_actions
    WHERE pharmacy_id = ? AND scan_id = ? ORDER BY created_at DESC
  `).all(pharmacyId, scanId);
  const scan = db.prepare(`
    SELECT c.phone FROM scans s LEFT JOIN customers c ON c.id = s.customer_id
    WHERE s.pharmacy_id = ? AND s.id = ?
  `).get(pharmacyId, scanId);
  return {
    scan_id: scanId,
    actions: rows,
    checklist: {
      phone_saved: Boolean(scan?.phone) || rows.some((row) => row.action === 'phone_saved'),
      routine_sent: rows.some((row) => row.action === 'routine_sent' || row.action === 'share'),
      product_slip_printed: rows.some((row) => row.action === 'print'),
      visit_completed: rows.some((row) => row.action === 'complete_visit'),
    },
  };
}
