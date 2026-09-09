import './server/loadEnv.mjs';
import http from 'node:http';
import { spawn } from 'node:child_process';
import process from 'node:process';
import { analyzeSkinWithGemini } from './gemini-skin-analysis.js';
import { analyzeSkinWithOpenRouter } from './openrouter-skin-analysis.js';
import { analyzeSkinWithOpenAI } from './openai-skin-analysis.js';
import { getDb, getDataDir } from './server/db.mjs';
import { getStorage } from './server/storage.mjs';
import {
  activateDevice,
  heartbeat,
  licenseRequired,
  licenseStatusForPharmacy,
  optionalDevice,
  requireDevice,
  assertFeature,
} from './server/license.mjs';
import {
  createSession,
  createScan,
  finalizeScanAnalysis,
  markScanAnalyzing,
  markScanFailed,
  getScanCustomer,
  customerPayloadFromResult,
  linkScanCustomer,
} from './server/sessions.mjs';
import { createAndSendRoutineShare, getSharedRoutine } from './server/shareRoutine.mjs';
import { upsertCustomer, getCustomerProgress } from './server/customers.mjs';
import {
  staffLogin,
  requireStaff,
  listTodayScans,
  getScanDetailForPharmacy,
  attachScanExtras,
} from './server/pharmacyStaff.mjs';
import { listPharmacyProducts, upsertPharmacyProduct, enrichRecommendations } from './server/pharmacyProducts.mjs';
import { listAuditEvents, recordAuditEvent } from './server/audit.mjs';
import { assertRateLimit } from './server/rateLimit.mjs';
import {
  getPharmacyAnalytics,
  getScanChecklist,
  recordScanStaffAction,
  searchCatalog,
  searchPharmacyCustomers,
} from './server/pharmacyOps.mjs';
import {
  requireAdmin,
  adminCreatePharmacy,
  adminRevokeDevice,
  adminRenewSubscription,
  adminListPharmacies,
  adminListDevices,
} from './server/admin.mjs';

const PORT = Number(process.env.PORT || 8787);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENAI_DAILY_LIMIT = Number(process.env.OPENAI_DAILY_LIMIT || 200);
const GEMINI_DAILY_LIMIT = Number(process.env.GEMINI_DAILY_LIMIT || 500);
const OPENROUTER_DAILY_LIMIT = Number(process.env.OPENROUTER_DAILY_LIMIT || 180);
let dailyCounts = { openai: 0, gemini: 0, openrouter: 0 };
let dayKey = new Date().toDateString();
function quotaOk(provider, limit) {
  const today = new Date().toDateString();
  if (today !== dayKey) { dayKey = today; dailyCounts = { openai: 0, gemini: 0, openrouter: 0 }; }
  return dailyCounts[provider] < limit;
}

async function analyzeWithPremiumProvider(imageDataUrl) {
  if (OPENAI_API_KEY && quotaOk('openai', OPENAI_DAILY_LIMIT)) {
    try {
      dailyCounts.openai++;
      return await analyzeSkinWithOpenAI(imageDataUrl, OPENAI_API_KEY);
    } catch (e) {
      console.error('[OpenAI] failed, trying Gemini next:', e.message);
    }
  }
  if (GEMINI_API_KEY && quotaOk('gemini', GEMINI_DAILY_LIMIT)) {
    try {
      dailyCounts.gemini++;
      return await analyzeSkinWithGemini(imageDataUrl, GEMINI_API_KEY);
    } catch (e) {
      console.error('[Gemini] failed, trying OpenRouter next:', e.message);
    }
  }
  if (OPENROUTER_API_KEY && quotaOk('openrouter', OPENROUTER_DAILY_LIMIT)) {
    try {
      dailyCounts.openrouter++;
      return await analyzeSkinWithOpenRouter(imageDataUrl, OPENROUTER_API_KEY);
    } catch (e) {
      console.error('[OpenRouter] failed:', e.message);
    }
  }
  return null;
}

const AI_PORT = Number(process.env.POOSTA_AI_PORT || 8788);
const PYTHON_BIN = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');
let aiProcess = null;

function send(res, status, body) {
  const defaultCodes = {
    400: 'BAD_REQUEST', 401: 'UNAUTHORIZED', 403: 'FORBIDDEN', 404: 'NOT_FOUND',
    409: 'CONFLICT', 413: 'PAYLOAD_TOO_LARGE', 429: 'RATE_LIMITED',
    500: 'INTERNAL_ERROR', 503: 'SERVICE_UNAVAILABLE',
  };
  const payload = status >= 400 && body?.error && !body.code
    ? { ...body, code: defaultCodes[status] || 'REQUEST_FAILED' }
    : body;
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Poosta-Staff-Token, X-Poosta-Admin-Key',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  });
  res.end(JSON.stringify(payload));
}

function sendErr(res, err) {
  const status = err.status || 500;
  const body = { error: err.message || 'خطای سرور', code: err.code || 'ERROR' };
  if (err.imageQuality) body.imageQuality = err.imageQuality;
  if (err.retryAfter) body.retry_after = err.retryAfter;
  send(res, status, body);
}

function readBody(req, limit = 20_000_000) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > limit) {
        reject(Object.assign(new Error('درخواست بیش از حد بزرگ است.'), { status: 413, code: 'PAYLOAD_TOO_LARGE' }));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(Object.assign(new Error('JSON نامعتبر است.'), { status: 400, code: 'BAD_JSON' }));
      }
    });
    req.on('error', reject);
  });
}

function startAiServer() {
  if (process.env.POOSTA_AI_AUTOSTART === 'false') return;
  aiProcess = spawn(PYTHON_BIN, ['ai/skin_ai_server.py'], {
    cwd: process.cwd(),
    env: { ...process.env, POOSTA_AI_PORT: String(AI_PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  aiProcess.stdout.on('data', (d) => process.stdout.write(`[AI] ${d}`));
  aiProcess.stderr.on('data', (d) => process.stderr.write(`[AI] ${d}`));
  aiProcess.on('error', (err) => console.error(`[AI] Could not start Python: ${err.message}`));
  aiProcess.on('exit', (code) => console.log(`[AI] process exited with code ${code}`));
}

async function proxy(path, method, body) {
  const response = await fetch(`http://127.0.0.1:${AI_PORT}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = { error: text }; }
  return { status: response.status, body: parsed };
}

/** Best-effort local pass for face/lesion boxes only (does not replace premium metrics). */
async function enrichBoxesFromLocal(imageDataUrl, result) {
  try {
    const local = await proxy('/analyze', 'POST', { imageDataUrl });
    if (local.status >= 400) return result;
    const existingBoxes = Array.isArray(result?.annotationBoxes) ? result.annotationBoxes : [];
    const localBoxes = Array.isArray(local.body?.annotationBoxes) ? local.body.annotationBoxes : [];
    const boxes = [...existingBoxes, ...localBoxes];
    const faceBox = local.body?.imageQuality?.faceBox;
    return {
      ...result,
      annotationBoxes: boxes,
      imageQuality: {
        ...(result.imageQuality || {}),
        faceBox: result.imageQuality?.faceBox || faceBox,
        faceMethod: result.imageQuality?.faceMethod || local.body?.imageQuality?.faceMethod,
      },
    };
  } catch {
    return result;
  }
}

async function assertImageQuality(imageDataUrl) {
  let q;
  try {
    q = await proxy('/quality', 'POST', { imageDataUrl });
  } catch (error) {
    console.warn('[quality] local pre-check unavailable; cloud provider will validate the image:', error.message);
    return { suitable: true, issues: ['local_quality_gate_unavailable'], providerValidationRequired: true };
  }
  if (q.status >= 500) {
    console.warn('[quality] local pre-check returned', q.status, '- cloud provider will validate the image');
    return { suitable: true, issues: ['local_quality_gate_unavailable'], providerValidationRequired: true };
  }
  const iq = q.body?.imageQuality || {};
  if (q.status >= 400 || q.body?.ok === false || iq.suitable === false) {
    const msg = q.body?.error || iq.issues?.[0] || 'کیفیت تصویر یا تشخیص چهره مناسب نیست.';
    const err = new Error(msg);
    err.status = 400;
    err.code = 'IMAGE_QUALITY';
    err.imageQuality = iq;
    throw err;
  }
  return iq;
}

async function runAnalysis(body) {
  const mode = body.mode === 'accurate' || body.mode === 'standard' ? body.mode : 'auto';

  // Face + quality gate BEFORE any local YOLO / Gemini / OpenRouter call
  await assertImageQuality(body.imageDataUrl);

  let result;

  if (mode === 'standard') {
    const local = await proxy('/analyze', 'POST', body);
    if (local.status >= 400) {
      const err = new Error(local.body?.error || 'تحلیل محلی ناموفق بود.');
      err.status = local.status;
      err.imageQuality = local.body?.imageQuality;
      throw err;
    }
    result = { ...local.body, providerUsed: 'local' };
  } else {
    const premium = await analyzeWithPremiumProvider(body.imageDataUrl);
    if (premium) {
      if (premium.imageQuality && premium.imageQuality.suitable === false) {
        const err = new Error(premium.imageQuality.issues?.[0] || 'کیفیت تصویر مناسب نیست.');
        err.status = 400;
        err.code = 'IMAGE_QUALITY';
        err.imageQuality = premium.imageQuality;
        throw err;
      }
      // Prefer local skin-age if premium omitted it
      result = { ...premium, providerUsed: premium.provider };
      if (mode === 'accurate' || mode === 'auto') {
        result = await enrichBoxesFromLocal(body.imageDataUrl, result);
      }
      if (result.apparentSkinAge == null && result.metrics) {
        // Soft local age fill from premium metrics without re-running heavy models
        const m = result.metrics;
        const youth = (
          Number(m.fineLines ?? 50) + Number(m.texture ?? 50) + Number(m.darkSpots ?? 50)
          + Number(m.pores ?? 50) + Number(m.acne ?? 50)
        ) / 5;
        const apparent = Math.max(18, Math.min(70, Math.round(55 - youth * 0.33)));
        result.apparentSkinAge = apparent;
        result.apparentSkinAgeNote = `بر اساس ظاهر پوست در عکس، پوست شما حدوداً ${apparent} ساله به نظر می‌رسد. این یک برآورد ظاهری/کازمتیک است، نه سن واقعی یا تشخیص پزشکی.`;
      }
    } else if (mode === 'accurate') {
      const err = new Error('سرویس تحلیل ابری (OpenAI/Gemini/OpenRouter) در دسترس نیست یا کلید API تنظیم نشده است. لطفاً تنظیمات سرور را بررسی کنید یا «تحلیل معمولی» را امتحان کنید.');
      err.status = 503;
      throw err;
    } else {
      const local = await proxy('/analyze', 'POST', body);
      if (local.status >= 400) {
        const err = new Error(local.body?.error || 'سرویس AI در دسترس نیست.');
        err.status = local.status;
        throw err;
      }
      result = { ...local.body, providerUsed: 'local' };
    }
  }
  return result;
}

// Init DB early so health can report it
try { getDb(); } catch (e) { console.error('[db] init failed:', e.message); }

startAiServer();

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  const path = req.url?.split('?')[0];

  try {
    if (path?.startsWith('/api/admin/')) {
      assertRateLimit(req, 'admin', { limit: 90, windowMs: 60_000 });
    }

    if (path === '/health' && req.method === 'GET') {
      let dbOk = false;
      try { getDb().prepare('SELECT 1').get(); dbOk = true; } catch { /* */ }
      return send(res, 200, {
        ok: true,
        aiPort: AI_PORT,
        openaiConfigured: Boolean(OPENAI_API_KEY),
        geminiConfigured: Boolean(GEMINI_API_KEY),
        openrouterConfigured: Boolean(OPENROUTER_API_KEY),
        dailyCounts,
        limits: { openai: OPENAI_DAILY_LIMIT, gemini: GEMINI_DAILY_LIMIT, openrouter: OPENROUTER_DAILY_LIMIT },
        licenseRequired: licenseRequired(),
        dataDir: getDataDir(),
        dbOk,
        storageOk: Boolean(getStorage()),
      });
    }

    if (path === '/api/device/activate' && req.method === 'POST') {
      const body = await readBody(req, 100_000);
      assertRateLimit(req, 'device-activation', { limit: 8, windowMs: 15 * 60_000 }, body.activation_code || body.activationCode);
      const out = activateDevice({ activationCode: body.activation_code || body.activationCode, appVersion: body.app_version || body.appVersion });
      recordAuditEvent({
        pharmacyId: out.pharmacy_id,
        actorType: 'device',
        actorId: out.device_id,
        eventType: 'device.activated',
        entityType: 'device',
        entityId: out.device_id,
        metadata: { app_version: body.app_version || body.appVersion || null },
      });
      return send(res, 200, out);
    }

    if (path === '/api/image-quality' && req.method === 'POST') {
      const body = await readBody(req);
      if (!body.imageDataUrl) {
        return send(res, 400, { error: 'imageDataUrl الزامی است.', code: 'BAD_REQUEST' });
      }
      try {
        const iq = await assertImageQuality(body.imageDataUrl);
        return send(res, 200, { ok: true, imageQuality: iq });
      } catch (e) {
        return send(res, e.status || 400, {
          ok: false,
          error: e.message,
          code: e.code || 'IMAGE_QUALITY',
          imageQuality: e.imageQuality || null,
        });
      }
    }

    if (path === '/api/device/heartbeat' && req.method === 'POST') {
      const auth = requireDevice(req);
      const body = await readBody(req, 100_000);
      const out = heartbeat(auth.device, body.app_version || body.appVersion);
      return send(res, 200, out);
    }

    if (path === '/api/license/status' && req.method === 'GET') {
      const auth = requireDevice(req);
      return send(res, 200, auth.license);
    }

    if (path === '/api/sessions' && req.method === 'POST') {
      const auth = optionalDevice(req);
      assertFeature(auth.license, 'skin_analysis');
      const session = createSession({
        pharmacyId: auth.device.pharmacy_id,
        deviceId: auth.device.device_id,
      });
      return send(res, 200, session);
    }

    if (path === '/api/scans' && req.method === 'POST') {
      const auth = optionalDevice(req);
      assertFeature(auth.license, 'skin_analysis');
      const body = await readBody(req);
      if (!body.imageDataUrl) {
        return send(res, 400, { error: 'imageDataUrl الزامی است.', code: 'BAD_REQUEST' });
      }
      const scan = await createScan({
        sessionId: body.session_id || body.sessionId,
        pharmacyId: auth.device.pharmacy_id,
        deviceId: auth.device.device_id,
        mode: body.mode,
        imageDataUrl: body.imageDataUrl,
      });
      // Never return storage keys to client
      return send(res, 200, { scan_id: scan.scan_id, session_id: scan.session_id });
    }

    if (path?.startsWith('/api/scans/') && req.method === 'GET') {
      const auth = optionalDevice(req);
      const scanId = path.slice('/api/scans/'.length);
      const row = getScanCustomer(scanId, auth.device.pharmacy_id);
      if (!row) return send(res, 404, { error: 'اسکن پیدا نشد.', code: 'NOT_FOUND' });
      return send(res, 200, row);
    }

    if (path === '/api/routines/share' && req.method === 'POST') {
      const auth = optionalDevice(req);
      assertFeature(auth.license, 'routine_sms');
      assertRateLimit(req, 'routine-share', { limit: 12, windowMs: 10 * 60_000 }, auth.device.device_id);
      const body = await readBody(req, 2_000_000);
      const out = await createAndSendRoutineShare({
        pharmacyId: auth.device.pharmacy_id,
        deviceId: auth.device.device_id,
        phone: body.phone,
        routine: body.routine,
        overallScore: body.overallScore ?? body.overall_score,
        sendSmsFlag: body.send_sms !== false,
        scanId: body.scan_id || body.scanId,
      });
      recordAuditEvent({
        pharmacyId: auth.device.pharmacy_id,
        actorType: 'device',
        actorId: auth.device.device_id,
        eventType: 'routine.sent',
        entityType: 'shared_routine',
        entityId: out.share_id,
        metadata: { scan_id: body.scan_id || body.scanId || null, sms: out.sms },
      });
      return send(res, 200, out);
    }

    if (path?.startsWith('/api/routines/shared/') && req.method === 'GET') {
      const token = decodeURIComponent(path.slice('/api/routines/shared/'.length));
      const shared = getSharedRoutine(token);
      if (!shared) return send(res, 404, { error: 'لینک روتین پیدا نشد.', code: 'NOT_FOUND' });
      if (shared.expired) return send(res, 410, { error: 'این لینک منقضی شده است.', code: 'EXPIRED' });
      return send(res, 200, shared);
    }

    // --- Pharmacy staff ---
    if (path === '/api/pharmacy/login' && req.method === 'POST') {
      const body = await readBody(req, 100_000);
      assertRateLimit(req, 'staff-login', { limit: 10, windowMs: 15 * 60_000 }, body.code || body.pharmacy_code);
      const out = staffLogin({ code: body.code || body.pharmacy_code, pin: body.pin });
      recordAuditEvent({
        pharmacyId: out.pharmacy.id,
        actorType: 'staff',
        actorId: out.pharmacy.code,
        eventType: 'staff.login',
        entityType: 'pharmacy',
        entityId: out.pharmacy.id,
      });
      return send(res, 200, out);
    }

    if (path === '/api/pharmacy/scans/today' && req.method === 'GET') {
      const staff = requireStaff(req);
      const url = new URL(req.url, 'http://localhost');
      const since = url.searchParams.get('since') || undefined;
      const scans = listTodayScans(staff.pharmacy_id, { since });
      return send(res, 200, { pharmacy_id: staff.pharmacy_id, scans });
    }

    if (path?.startsWith('/api/pharmacy/scans/') && req.method === 'GET') {
      const staff = requireStaff(req);
      const scanId = path.slice('/api/pharmacy/scans/'.length);
      const detail = getScanDetailForPharmacy(staff.pharmacy_id, scanId);
      if (!detail) return send(res, 404, { error: 'اسکن پیدا نشد.', code: 'NOT_FOUND' });
      detail.recommendations = enrichRecommendations(staff.pharmacy_id, detail.recommendations);
      detail.visit = getScanChecklist(staff.pharmacy_id, scanId);
      return send(res, 200, detail);
    }

    if (path?.match(/^\/api\/pharmacy\/scans\/[^/]+\/actions$/) && req.method === 'POST') {
      const staff = requireStaff(req);
      const scanId = path.split('/')[4];
      const body = await readBody(req, 100_000);
      let share = null;
      if (body.action === 'share') {
        assertRateLimit(req, 'staff-routine-share', { limit: 12, windowMs: 10 * 60_000 }, staff.pharmacy_id);
        const detail = getScanDetailForPharmacy(staff.pharmacy_id, scanId);
        if (!detail?.phone || !detail?.routine) {
          const err = new Error('برای ارسال دوباره، شماره مشتری و روتین ذخیره‌شده لازم است.');
          err.status = 400;
          err.code = 'ROUTINE_RESEND_UNAVAILABLE';
          throw err;
        }
        share = await createAndSendRoutineShare({
          pharmacyId: staff.pharmacy_id,
          deviceId: null,
          phone: detail.phone,
          routine: detail.routine,
          overallScore: detail.overallScore,
          sendSmsFlag: true,
          scanId,
        });
      }
      const visit = recordScanStaffAction({
        pharmacyId: staff.pharmacy_id,
        staffTokenId: staff.id,
        scanId,
        action: String(body.action || ''),
        note: body.note,
      });
      return send(res, 200, { ...visit, share });
    }

    if (path === '/api/pharmacy/analytics' && req.method === 'GET') {
      const staff = requireStaff(req);
      const url = new URL(req.url, 'http://localhost');
      const range = url.searchParams.get('range') || 'today';
      const analytics = getPharmacyAnalytics(staff.pharmacy_id, range);
      const devices = getDb().prepare(`
        SELECT id, device_code, status, last_seen, app_version
        FROM devices WHERE pharmacy_id = ? ORDER BY registered_at DESC
      `).all(staff.pharmacy_id);
      return send(res, 200, {
        ...analytics,
        license: licenseStatusForPharmacy(staff.pharmacy_id),
        devices,
      });
    }

    if (path === '/api/pharmacy/customers' && req.method === 'GET') {
      const staff = requireStaff(req);
      const url = new URL(req.url, 'http://localhost');
      return send(res, 200, {
        customers: searchPharmacyCustomers(staff.pharmacy_id, url.searchParams.get('phone') || ''),
      });
    }

    if (path === '/api/pharmacy/catalog/search' && req.method === 'GET') {
      const staff = requireStaff(req);
      const url = new URL(req.url, 'http://localhost');
      return send(res, 200, {
        products: searchCatalog(staff.pharmacy_id, url.searchParams.get('q') || ''),
      });
    }

    if (path === '/api/pharmacy/audit' && req.method === 'GET') {
      const staff = requireStaff(req);
      const url = new URL(req.url, 'http://localhost');
      return send(res, 200, {
        events: listAuditEvents(staff.pharmacy_id, { limit: url.searchParams.get('limit') }),
      });
    }

    if (path === '/api/pharmacy/customers/progress' && req.method === 'GET') {
      const staff = requireStaff(req);
      const url = new URL(req.url, 'http://localhost');
      const phone = url.searchParams.get('phone');
      const progress = getCustomerProgress(staff.pharmacy_id, phone);
      if (!progress) return send(res, 400, { error: 'شماره نامعتبر است.', code: 'INVALID_PHONE' });
      return send(res, 200, progress);
    }

    if (path === '/api/pharmacy/products' && req.method === 'GET') {
      const staff = requireStaff(req);
      return send(res, 200, { products: listPharmacyProducts(staff.pharmacy_id) });
    }

    if (path === '/api/pharmacy/products' && req.method === 'POST') {
      const staff = requireStaff(req);
      const body = await readBody(req, 200_000);
      const product = upsertPharmacyProduct(staff.pharmacy_id, body);
      recordAuditEvent({
        pharmacyId: staff.pharmacy_id,
        actorType: 'staff',
        actorId: staff.id,
        eventType: 'inventory.updated',
        entityType: 'pharmacy_product',
        entityId: product.id,
        metadata: { product_id: product.product_id, stock: product.stock, price: product.price },
      });
      return send(res, 200, product);
    }

    // Device: attach phone + recommendations after local routine build
    if (path?.match(/^\/api\/scans\/[^/]+\/handoff$/) && req.method === 'POST') {
      const auth = optionalDevice(req);
      const scanId = path.split('/')[3];
      const body = await readBody(req, 2_000_000);
      let customerId = null;
      if (body.phone) {
        const c = upsertCustomer({ pharmacyId: auth.device.pharmacy_id, phone: body.phone });
        customerId = c.id;
        linkScanCustomer(scanId, customerId);
      }
      const enriched = enrichRecommendations(
        auth.device.pharmacy_id,
        body.recommendations || body.products || [],
      );
      attachScanExtras(scanId, {
        recommendations: enriched,
        routine: body.routine,
        customerId,
      });
      let progress = null;
      if (body.phone) {
        progress = getCustomerProgress(auth.device.pharmacy_id, body.phone);
      }
      return send(res, 200, { ok: true, scan_id: scanId, customer_id: customerId, progress, recommendations: enriched });
    }

    if (path === '/api/customers/progress' && req.method === 'GET') {
      const auth = optionalDevice(req);
      const url = new URL(req.url, 'http://localhost');
      const phone = url.searchParams.get('phone');
      const progress = getCustomerProgress(auth.device.pharmacy_id, phone);
      if (!progress) return send(res, 400, { error: 'شماره نامعتبر است.', code: 'INVALID_PHONE' });
      return send(res, 200, progress);
    }

    // --- Admin ---
    if (path === '/api/admin/pharmacies' && req.method === 'GET') {
      requireAdmin(req);
      return send(res, 200, { pharmacies: adminListPharmacies() });
    }
    if (path === '/api/admin/pharmacies' && req.method === 'POST') {
      requireAdmin(req);
      const body = await readBody(req, 200_000);
      const out = adminCreatePharmacy(body);
      recordAuditEvent({ pharmacyId: out.pharmacy.id, actorType: 'admin', eventType: 'pharmacy.created', entityType: 'pharmacy', entityId: out.pharmacy.id });
      return send(res, 200, out);
    }
    if (path === '/api/admin/devices/revoke' && req.method === 'POST') {
      requireAdmin(req);
      const body = await readBody(req, 100_000);
      const deviceId = body.device_id || body.deviceId;
      const device = getDb().prepare('SELECT pharmacy_id FROM devices WHERE id = ?').get(deviceId);
      const out = adminRevokeDevice(deviceId);
      recordAuditEvent({ pharmacyId: device?.pharmacy_id || null, actorType: 'admin', eventType: 'device.revoked', entityType: 'device', entityId: out.device_id });
      return send(res, 200, out);
    }
    if (path === '/api/admin/subscriptions/renew' && req.method === 'POST') {
      requireAdmin(req);
      const body = await readBody(req, 100_000);
      const out = adminRenewSubscription({
        pharmacyId: body.pharmacy_id || body.pharmacyId,
        plan: body.plan,
        years: body.years,
      });
      recordAuditEvent({ pharmacyId: body.pharmacy_id || body.pharmacyId, actorType: 'admin', eventType: 'subscription.renewed', entityType: 'subscription', entityId: out.subscription_id, metadata: { plan_id: out.plan_id, expires_at: out.expires_at } });
      return send(res, 200, out);
    }
    if (path?.startsWith('/api/admin/pharmacies/') && path.endsWith('/devices') && req.method === 'GET') {
      requireAdmin(req);
      const pharmacyId = path.split('/')[4];
      return send(res, 200, { devices: adminListDevices(pharmacyId) });
    }

    if (path === '/api/skin-analysis' && req.method === 'POST') {
      const auth = optionalDevice(req);
      assertFeature(auth.license, 'skin_analysis');
      const body = await readBody(req);
      if (!body.imageDataUrl) {
        return send(res, 400, { error: 'imageDataUrl الزامی است.', code: 'BAD_REQUEST' });
      }
      if (body.mode === 'accurate') {
        assertFeature(auth.license, 'accurate_analysis');
      }

      let scanId = body.scan_id || body.scanId;
      let customerId = null;
      if (body.phone) {
        try {
          customerId = upsertCustomer({ pharmacyId: auth.device.pharmacy_id, phone: body.phone }).id;
        } catch (e) {
          console.warn('[customer]', e.message);
        }
      }
      if (!scanId) {
        try {
          const created = await createScan({
            sessionId: body.session_id || body.sessionId || null,
            pharmacyId: auth.device.pharmacy_id,
            deviceId: auth.device.device_id,
            mode: body.mode || 'standard',
            imageDataUrl: body.imageDataUrl,
          });
          scanId = created.scan_id;
        } catch (e) {
          console.error('[scan] create failed:', e.message);
        }
      }

      if (scanId) markScanAnalyzing(scanId);
      let result;
      try {
        result = await runAnalysis({
          ...body,
          chronologicalAge: body.chronologicalAge ?? body.age ?? undefined,
        });
      } catch (error) {
        if (scanId) markScanFailed(scanId, error instanceof Error ? error.message : 'analysis failed');
        throw error;
      }
      let customer = customerPayloadFromResult(result);

      if (scanId) {
        customer = await finalizeScanAnalysis({
          scanId,
          analysisResult: result,
          mode: body.mode || 'standard',
          customerId,
        });
      }

      return send(res, 200, { ...customer, scanId });
    }

    return send(res, 404, { error: 'Not found', code: 'ROUTE_NOT_FOUND' });
  } catch (e) {
    if (e.code || e.status) return sendErr(res, e);
    console.error(e);
    return send(res, 503, { error: `سرویس در دسترس نیست: ${e instanceof Error ? e.message : 'unknown error'}`, code: 'SERVICE_UNAVAILABLE' });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Poosta API: http://0.0.0.0:${PORT}`);
  console.log(`  licenseRequired=${licenseRequired()} dataDir=${getDataDir()}`);
  console.log('  Training assets are collected only — never auto-retrained.');
});

function shutdown() {
  if (aiProcess) aiProcess.kill();
  server.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
