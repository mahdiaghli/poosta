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

async function req(method, urlPath, { body, token } = {}) {
  const res = await fetch(`${BASE}${urlPath}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
