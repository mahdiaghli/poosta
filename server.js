import http from 'node:http';
import { spawn } from 'node:child_process';
import process from 'node:process';

const PORT = Number(process.env.PORT || 8787);
const AI_PORT = Number(process.env.POOSTA_AI_PORT || 8788);
const PYTHON_BIN = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');
let aiProcess = null;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.trim();
const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || 'gemini-3.1-pro-preview';

function send(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  });
  res.end(JSON.stringify(body));
}


function extractGeminiText(response) {
  const parts = response?.candidates?.[0]?.content?.parts || [];
  return parts.filter((part) => typeof part.text === 'string').map((part) => part.text).join('\n').trim();
}

function parseJsonObject(text) {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try { return JSON.parse(cleaned); } catch {}
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first >= 0 && last > first) {
    try { return JSON.parse(cleaned.slice(first, last + 1)); } catch {}
  }
  throw new Error('پاسخ Gemini به فرمت JSON معتبر برنگشت.');
}

async function analyzeWithGemini({ imageDataUrl, profile = {} }) {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY در فایل .env تنظیم نشده است.');
  if (!imageDataUrl || typeof imageDataUrl !== 'string' || !imageDataUrl.includes(',')) {
    throw new Error('تصویر برای Gemini معتبر نیست.');
  }

  const [header, data] = imageDataUrl.split(',', 2);
  const mimeType = header.match(/^data:([^;]+);/i)?.[1] || 'image/jpeg';
  const prompt = `
You are the high-accuracy vision analysis engine for a skincare application.
Analyze ONLY visible characteristics in the provided face image. Do not diagnose disease and do not invent findings that cannot be visually supported.
Return ONLY valid JSON, with no markdown and no extra text.
Use this exact schema:
{
  "overallScore": 0,
  "metrics": {
    "acne": 0,
    "oiliness": 0,
    "hydration": 0,
    "redness": 0,
    "pores": 0,
    "darkSpots": 0,
    "texture": 0,
    "fineLines": 0
  },
  "concerns": [],
  "topOpportunities": [],
  "confidence": 0.0,
  "imageQuality": {
    "suitable": true,
    "faceDetected": true,
    "faceCount": 1,
    "frontal": true,
    "faceVisibility": "clear",
    "qualityScore": 0.0,
    "issues": []
  },
  "observations": [],
  "limitations": [],
  "recommendedNextStep": ""
}
Scoring: each metric is 0-100 where 100 means better/healthier condition and 0 means more visible concern. overallScore is a balanced overall skin-quality score, not a medical score. confidence is 0-1.
Use only these metric keys in concerns/topOpportunities: acne, oiliness, hydration, redness, pores, darkSpots, texture, fineLines.
First verify image quality: exactly one visible face, reasonably frontal, enough resolution/lighting, and face not heavily occluded. If unsuitable, set imageQuality.suitable=false and explain issues; still return the JSON.
User profile context (may be empty): ${JSON.stringify(profile)}
`.trim();

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }, { inlineData: { mimeType, data } }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
        maxOutputTokens: 4096,
      },
    }),
  });
  const rawText = await response.text();
  let payload;
  try { payload = JSON.parse(rawText); } catch { payload = { error: rawText }; }
  if (!response.ok) {
    const message = payload?.error?.message || payload?.message || `Gemini API error ${response.status}`;
    throw new Error(message);
  }

  const text = extractGeminiText(payload);
  const result = parseJsonObject(text);
  result.provider = `gemini:${GEMINI_MODEL}`;
  result.createdAt = new Date().toISOString();
  result.limitations = Array.isArray(result.limitations) ? result.limitations : [];
  if (!result.limitations.some((x) => String(x).includes('medical'))) {
    result.limitations.unshift('این تحلیل تصویری برای اهداف مراقبت از پوست است و تشخیص پزشکی محسوب نمی‌شود.');
  }
  return result;
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
  if (path === '/health') return send(res, 200, { ok: true, provider: 'local-yolo', aiPort: AI_PORT, geminiConfigured: Boolean(GEMINI_API_KEY), geminiModel: GEMINI_MODEL });
  if (path === '/api/gemini-skin-analysis' && req.method === 'POST') {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', async () => {
      try {
        if (raw.length > 25_000_000) return send(res, 413, { error: 'تصویر بیش از حد بزرگ است.' });
        const body = JSON.parse(raw);
        const result = await analyzeWithGemini(body);
        return send(res, 200, result);
      } catch (e) {
        return send(res, 503, { error: `Gemini در دسترس نیست: ${e instanceof Error ? e.message : 'unknown error'}` });
      }
    });
    return;
  }
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
