import http from 'node:http';
import { spawn } from 'node:child_process';
import process from 'node:process';

const PORT = Number(process.env.PORT || 8787);
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
  if (path === '/health') return send(res, 200, { ok: true, provider: 'local-yolo', aiPort: AI_PORT });
  if (path === '/api/skin-analysis' && req.method === 'POST') {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', async () => {
      try {
        if (raw.length > 20_000_000) return send(res, 413, { error: 'تصویر بیش از حد بزرگ است.' });
        const body = JSON.parse(raw);
        const result = await proxy('/analyze', 'POST', body);
        return send(res, result.status, result.body);
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
