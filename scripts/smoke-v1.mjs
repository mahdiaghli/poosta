/**
 * Smoke test for Pharmacy V1 licensing + scan asset collection.
 * Does NOT run model training.
 *
 * Usage: start API (`npm run api`), then `npm run smoke:v1`
 */
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.POOSTA_SMOKE_URL || 'http://127.0.0.1:8787';

// 1x1 JPEG
const TINY_JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGfAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//Z';

async function req(method, urlPath, { body, token, staffToken } = {}) {
  const res = await fetch(`${BASE}${urlPath}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(staffToken ? { 'X-Poosta-Staff-Token': staffToken } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  console.log('Smoke V1 against', BASE);

  const health = await req('GET', '/health');
  assert(health.status === 200 && health.json.ok, 'health failed');
  console.log('  health ok, licenseRequired=', health.json.licenseRequired);

  // Seed should already have been run; try activate with whatever code is pending
  const { spawnSync } = await import('node:child_process');
  const seed = spawnSync(process.execPath, ['scripts/seed-license.mjs'], { encoding: 'utf8' });
  assert(seed.status === 0, `seed failed: ${seed.stderr || seed.stdout}`);
  const match = /Activation code:\s*(\S+)/.exec(seed.stdout);
  assert(match, 'no activation code in seed output');
  const code = match[1];
  console.log('  activation code', code);

  const act = await req('POST', '/api/device/activate', { body: { activation_code: code } });
  assert(act.status === 200 && act.json.token, `activate failed: ${JSON.stringify(act.json)}`);
  const token = act.json.token;
  console.log('  activated');

  const hb = await req('POST', '/api/device/heartbeat', { body: {}, token });
  assert(hb.status === 200 && hb.json.token, 'heartbeat failed');

  const login = await req('POST', '/api/pharmacy/login', { body: { code: 'DEMO', pin: '1234' } });
  assert(login.status === 200 && login.json.token, `staff login failed: ${JSON.stringify(login.json)}`);
  const staffToken = login.json.token;

  const catalog = await req('GET', '/api/pharmacy/catalog/search?q=cerave', { staffToken });
  assert(catalog.status === 200 && Array.isArray(catalog.json.products) && catalog.json.products.length > 0, 'catalog search failed');
  const catalogProduct = catalog.json.products[0];

  // Seed one deterministic completed scan so staff handoff/actions do not depend on an AI provider.
  const { getDb, newId, nowIso } = await import('../server/db.mjs');
  const smokeScanId = newId('scan_smoke');
  getDb().prepare(`
    INSERT INTO scans (
      id, pharmacy_id, device_id, mode, status, provider, customer_result_json, created_at
    ) VALUES (?, 'pharmacy_demo', ?, 'standard', 'completed', 'smoke', ?, ?)
  `).run(smokeScanId, act.json.device_id, JSON.stringify({
    overallScore: 74,
    metrics: { hydration: 68, texture: 73 },
    concerns: ['dehydration'],
  }), nowIso());

  const routine = {
    morning: [{ name: 'Cleanser', productName: catalogProduct.name, frequency: 'daily' }],
    night: [],
    conflicts: [],
    variant: 'simple',
  };
  const handoff = await req('POST', `/api/scans/${smokeScanId}/handoff`, {
    token: hb.json.token,
    body: {
      phone: '09120000000',
      routine,
      recommendations: [{ id: catalogProduct.id, name: catalogProduct.name, brand: catalogProduct.brand, score: 90 }],
    },
  });
  assert(handoff.status === 200 && handoff.json.customer_id, 'scan handoff failed');
  assert(!JSON.stringify(handoff.json).includes('original_key'), 'handoff leaked storage keys');

  const scans = await req('GET', '/api/pharmacy/scans/today', { staffToken });
  assert(scans.status === 200 && scans.json.scans.some((scan) => scan.scan_id === smokeScanId), 'staff scan list failed');

  const detail = await req('GET', `/api/pharmacy/scans/${smokeScanId}`, { staffToken });
  assert(detail.status === 200 && detail.json.phone === '+989120000000', 'staff scan detail did not store phone');
  assert(detail.json.recommendations?.[0]?.id === catalogProduct.id, 'staff scan detail did not store recommendations');

  const action = await req('POST', `/api/pharmacy/scans/${smokeScanId}/actions`, {
    staffToken,
    body: { action: 'print' },
  });
  assert(action.status === 200 && action.json.checklist?.product_slip_printed, 'scan staff action failed');

  const resend = await req('POST', `/api/pharmacy/scans/${smokeScanId}/actions`, {
    staffToken,
    body: { action: 'share' },
  });
  assert(resend.status === 200 && resend.json.share?.url, 'routine resend failed');
  assert(!JSON.stringify(resend.json).includes('original_key'), 'routine resend leaked storage keys');

  const inventoryWrite = await req('POST', '/api/pharmacy/products', {
    staffToken,
    body: { product_id: catalogProduct.id, price: 100000, stock: 2, low_stock_threshold: 3, sku: 'SMOKE-001', available: true },
  });
  assert(inventoryWrite.status === 200 && inventoryWrite.json.low_stock_threshold === 3, 'inventory upsert failed');

  const inventory = await req('GET', '/api/pharmacy/products', { staffToken });
  assert(inventory.status === 200 && inventory.json.products.some((p) => p.product_id === catalogProduct.id), 'inventory list failed');

  const analytics = await req('GET', '/api/pharmacy/analytics?range=today', { staffToken });
  assert(analytics.status === 200, 'analytics failed');
  assert(analytics.json.scan_count === scans.json.scans.length, 'analytics scan count does not match staff queue');
  assert(analytics.json.low_stock_count >= 1, 'low stock analytics failed');

  const customerSearch = await req('GET', '/api/pharmacy/customers?phone=912', { staffToken });
  assert(customerSearch.status === 200 && Array.isArray(customerSearch.json.customers), 'customer search failed');

  const audit = await req('GET', '/api/pharmacy/audit', { staffToken });
  assert(audit.status === 200 && audit.json.events.some((event) => event.event_type === 'inventory.updated'), 'audit log failed');
  console.log('  staff, catalog, inventory, analytics and audit ok');

  const analysis = await req('POST', '/api/skin-analysis', {
    token: hb.json.token,
    body: { imageDataUrl: TINY_JPEG, mode: 'standard' },
  });
  // Tiny image may fail quality — still check no storage keys leaked on any response
  const leaked = JSON.stringify(analysis.json).includes('original_key')
    || JSON.stringify(analysis.json).includes('overlay_key')
    || JSON.stringify(analysis.json).includes('annotations_key');
  assert(!leaked, 'customer response leaked storage keys');
  console.log('  analysis status', analysis.status, analysis.json.error || analysis.json.scanId || 'ok');

  if (analysis.json.scanId) {
    const dataDir = path.resolve(process.env.POOSTA_DATA_DIR || 'data', 'scans');
    const found = fs.existsSync(dataDir);
    console.log('  scans dir exists:', found, dataDir);
  }

  console.log('Smoke V1 passed (no training invoked).');
}

main().catch((e) => {
  console.error('Smoke V1 FAILED:', e.message);
  process.exit(1);
});
