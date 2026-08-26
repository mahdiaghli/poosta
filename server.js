import http from 'node:http';
import { spawn } from 'node:child_process';
import process from 'node:process';
import { analyzeSkinWithGemini } from './gemini-skin-analysis.js';
import { analyzeSkinWithOpenRouter } from './openrouter-skin-analysis.js';

const PORT = Number(process.env.PORT || 8787);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
// Simple in-memory daily spend guard (resets on restart / midnight). Not a
// substitute for Google's own billing caps -- just an extra local safety net
// so a bug/bot can't silently run up an unbounded bill overnight.
const GEMINI_DAILY_LIMIT = Number(process.env.GEMINI_DAILY_LIMIT || 500);
const OPENROUTER_DAILY_LIMIT = Number(process.env.OPENROUTER_DAILY_LIMIT || 180); // OpenRouter free tier ~200/day
let dailyCounts = { gemini: 0, openrouter: 0 };
let dayKey = new Date().toDateString();
function quotaOk(provider, limit) {
  const today = new Date().toDateString();
  if (today !== dayKey) { dayKey = today; dailyCounts = { gemini: 0, openrouter: 0 }; }
  return dailyCounts[provider] < limit;
}

/** Tries Gemini then OpenRouter (both free-tier friendly). Returns null if
 *  neither is configured/available -- caller decides what to do (fall back
 *  to local, or tell the user premium analysis isn't available right now). */
async function analyzeWithPremiumProvider(imageDataUrl) {
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
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  });
  res.end(JSON.stringify(body));
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

startAiServer();

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  const path = req.url?.split('?')[0];
  if (path === '/health') return send(res, 200, {
    ok: true, aiPort: AI_PORT,
    geminiConfigured: Boolean(GEMINI_API_KEY), openrouterConfigured: Boolean(OPENROUTER_API_KEY),
    dailyCounts, limits: { gemini: GEMINI_DAILY_LIMIT, openrouter: OPENROUTER_DAILY_LIMIT },
  });
  if (path === '/api/skin-analysis' && req.method === 'POST') {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', async () => {
      try {
        if (raw.length > 20_000_000) return send(res, 413, { error: 'تصویر بیش از حد بزرگ است.' });
        const body = JSON.parse(raw);
        // mode: 'accurate' -> Gemini/OpenRouter (fine-grained, costs a request against
        // free-tier quota); 'standard' -> local models only, always free & offline.
        // Unset mode keeps the old best-effort behaviour (premium if available, else local).
        const mode = body.mode === 'accurate' || body.mode === 'standard' ? body.mode : 'auto';

        if (mode === 'standard') {
          const result = await proxy('/analyze', 'POST', body);
          return send(res, result.status, { ...result.body, providerUsed: 'local' });
        }

        const premium = await analyzeWithPremiumProvider(body.imageDataUrl);
        if (premium) return send(res, 200, { ...premium, providerUsed: premium.provider });

        if (mode === 'accurate') {
          return send(res, 503, { error: 'در حال حاضر سرویس تحلیل دقیق (Gemini/OpenRouter) در دسترس نیست یا کلید تنظیم نشده. لطفاً «تحلیل معمولی» را امتحان کنید.' });
        }

        const result = await proxy('/analyze', 'POST', body);
        return send(res, result.status, { ...result.body, providerUsed: 'local' });
      } catch (e) {
        return send(res, 503, { error: `سرویس AI در دسترس نیست: ${e instanceof Error ? e.message : 'unknown error'}` });
      }
    });
    return;
  }
  return send(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => console.log(`Poosta local API: http://localhost:${PORT}`));

function shutdown() {
  if (aiProcess) aiProcess.kill();
  server.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
