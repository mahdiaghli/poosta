import { getDb, newId, nowIso } from './db.mjs';
import { getStorage, scanObjectPrefix, parseDataUrl } from './storage.mjs';
import { buildAndStoreAnnotations } from './annotate.mjs';

export function createSession({ pharmacyId, deviceId }) {
  const id = newId('session');
  getDb().prepare(`
    INSERT INTO sessions (id, pharmacy_id, device_id, status, created_at)
    VALUES (?, ?, ?, 'active', ?)
  `).run(id, pharmacyId, deviceId, nowIso());
  return { session_id: id, pharmacy_id: pharmacyId, device_id: deviceId };
}

export async function createScan({ sessionId, pharmacyId, deviceId, mode, imageDataUrl }) {
  const id = newId('scan');
  const prefix = scanObjectPrefix(id);
  const originalKey = `${prefix}/original.jpg`;
  const { buffer } = parseDataUrl(imageDataUrl);
  await getStorage().put(originalKey, buffer);

  getDb().prepare(`
    INSERT INTO scans (
      id, session_id, pharmacy_id, device_id, mode, status,
      original_key, created_at
    ) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
  `).run(id, sessionId || null, pharmacyId, deviceId || null, mode || 'standard', originalKey, nowIso());

  return { scan_id: id, session_id: sessionId || null, original_key: originalKey };
}

export function customerPayloadFromResult(result) {
  if (!result || typeof result !== 'object') return result;
  const {
    annotationBoxes,
    trainingMeta,
    original_key,
    overlay_key,
    annotations_key,
    storage,
    ...safe
  } = result;
  return safe;
}

export async function finalizeScanAnalysis({ scanId, analysisResult, mode, customerId, recommendations, routine }) {
  const database = getDb();
  const scan = database.prepare('SELECT * FROM scans WHERE id = ?').get(scanId);
  if (!scan) throw new Error('Scan not found');

  const customer = customerPayloadFromResult(analysisResult);
  let overlayKey = null;
  let annotationsKey = null;
  let status = 'completed';

  try {
    const stored = await buildAndStoreAnnotations({
      scan,
      analysisResult,
      mode: mode || scan.mode,
    });
    overlayKey = stored.overlayKey;
    annotationsKey = stored.annotationsKey;
  } catch (err) {
    console.error('[annotate] failed (analysis still returned to customer):', err.message);
    status = 'completed_partial';
  }

  database.prepare(`
    UPDATE scans SET
      status = ?,
      provider = ?,
      customer_result_json = ?,
      overlay_key = ?,
      annotations_key = ?,
      customer_id = COALESCE(?, customer_id),
      recommendations_json = COALESCE(?, recommendations_json),
      routine_json = COALESCE(?, routine_json)
    WHERE id = ?
  `).run(
    status,
    analysisResult?.providerUsed || analysisResult?.provider || null,
    JSON.stringify(customer),
    overlayKey,
    annotationsKey,
    customerId || null,
    recommendations ? JSON.stringify(recommendations) : null,
    routine ? JSON.stringify(routine) : null,
    scanId,
  );

  return customer;
}

export function linkScanCustomer(scanId, customerId) {
  getDb().prepare('UPDATE scans SET customer_id = ? WHERE id = ?').run(customerId, scanId);
}

export function getScanCustomer(scanId, pharmacyId) {
  const scan = getDb().prepare('SELECT * FROM scans WHERE id = ?').get(scanId);
  if (!scan) return null;
  if (pharmacyId && scan.pharmacy_id !== pharmacyId && pharmacyId !== 'local-dev') return null;
  return {
    scan_id: scan.id,
    status: scan.status,
    mode: scan.mode,
    created_at: scan.created_at,
    result: scan.customer_result_json ? JSON.parse(scan.customer_result_json) : null,
  };
}
