/**
 * Gemini vision provider for skin analysis. Called from server.js.
 * Server-side ONLY -- the API key must never reach the browser.
 *
 * Model swap point: set GEMINI_MODEL in .env if Google renames/deprecates
 * the default below. Check current model ids at
 * https://ai.google.dev/gemini-api/docs/models before going live.
 */
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_URL = (key) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;

const METRIC_KEYS = ['acne', 'oiliness', 'hydration', 'redness', 'pores', 'darkSpots', 'texture', 'fineLines'];

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    imageQuality: {
      type: 'OBJECT',
      properties: {
        suitable: { type: 'BOOLEAN' },
        issues: { type: 'ARRAY', items: { type: 'STRING' } },
      },
      required: ['suitable', 'issues'],
    },
    overallScore: { type: 'INTEGER' },
    metrics: {
      type: 'OBJECT',
      properties: Object.fromEntries(METRIC_KEYS.map((k) => [k, { type: 'INTEGER' }])),
      required: METRIC_KEYS,
    },
    concerns: { type: 'ARRAY', items: { type: 'STRING', enum: METRIC_KEYS } },
    topOpportunities: { type: 'ARRAY', items: { type: 'STRING', enum: METRIC_KEYS } },
    confidence: { type: 'NUMBER' },
    observations: { type: 'ARRAY', items: { type: 'STRING' } },
    limitations: { type: 'ARRAY', items: { type: 'STRING' } },
    recommendedNextStep: { type: 'STRING' },
  },
  required: ['imageQuality', 'overallScore', 'metrics', 'concerns', 'topOpportunities', 'confidence'],
};

const PROMPT = `تو یک دستیار ارزیابی ظاهری پوست هستی، نه پزشک. این تشخیص پزشکی نیست.
عکس صورت پیوست‌شده را بررسی کن:
1) اگر عکس مناسب تحلیل نیست (چهره مشخص نیست، خیلی تار/تاریک است، بیش از یک چهره دارد)، imageQuality.suitable را false کن و دلیل را در issues (فارسی) بنویس؛ در این حالت بقیه فیلدها را با مقدار خنثی (۵۰) پر کن.
2) اگر مناسب است، برای هر شاخص زیر عددی بین ۰ تا ۱۰۰ بده (۱۰۰ یعنی بهترین وضعیت):
   acne, oiliness, hydration, redness, pores, darkSpots, texture, fineLines
3) overallScore را بر اساس اهمیت نسبی شاخص‌ها (نه میانگین ساده) بده.
4) concerns: شاخص‌هایی با امتیاز زیر ۵۰. topOpportunities: دو شاخص با بیشترین فرصت بهبود.
5) confidence بین ۰ تا ۱ (میزان اطمینان خودت از این ارزیابی، با توجه به کیفیت عکس).
6) observations: ۳ تا ۶ جمله‌ی کوتاه فارسی درباره‌ی مشاهدات واقعی روی عکس.
7) limitations: حتماً این را بگو که این یک ارزیابی ظاهری/کازمتیک است، نه تشخیص پزشکی، و در موارد جدی باید به متخصص پوست مراجعه شود.
فقط JSON مطابق اسکیمای داده‌شده برگردان.`;

/**
 * analyzeSkinWithGemini(imageDataUrl, apiKey) -> parsed result matching
 * SkinAnalysisResult (minus provider/createdAt, added by the caller).
 * Throws on any failure -- caller (server.js) must catch and fall back.
 */
export async function analyzeSkinWithGemini(imageDataUrl, apiKey) {
  const match = /^data:(image\/\w+);base64,(.+)$/.exec(imageDataUrl);
  if (!match) throw new Error('Invalid image data URL');
  const [, mimeType, base64] = match;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  let response;
  try {
    response = await fetch(GEMINI_URL(apiKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT }, { inlineData: { mimeType, data: base64 } }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
          temperature: 0.2,
        },
      }),
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    throw new Error(`Gemini API error ${response.status}: ${errBody.slice(0, 300)}`);
  }
  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned no content');
  const parsed = JSON.parse(text);
  return { ...parsed, provider: `gemini:${GEMINI_MODEL}`, createdAt: new Date().toISOString() };
}
