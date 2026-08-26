/**
 * OpenRouter free vision-model provider -- a genuinely $0 alternative/backup
 * to Gemini (rate-limited, not a trial). Uses Qwen2.5-VL-72B by default
 * (":free" suffix models on OpenRouter, no credit card required). Server-side
 * only, same JSON-schema contract as gemini-skin-analysis.js.
 *
 * Get a key: https://openrouter.ai/keys (free, no card).
 * Model list / current free status: https://openrouter.ai/models?q=free
 * (free model lineup rotates -- check OPENROUTER_MODEL still exists if this
 * stops working).
 */
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'qwen/qwen2.5-vl-72b-instruct:free';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const METRIC_KEYS = ['acne', 'oiliness', 'hydration', 'redness', 'pores', 'darkSpots', 'texture', 'fineLines'];

const PROMPT = `تو یک دستیار ارزیابی ظاهری پوست هستی، نه پزشک؛ این تشخیص پزشکی نیست.
عکس صورت را بررسی کن و فقط یک JSON با این ساختار برگردان (بدون هیچ متن اضافه، بدون Markdown):
{
 "imageQuality": {"suitable": boolean, "issues": string[]},
 "overallScore": number (0-100, وزن‌دار نه میانگین ساده),
 "metrics": {"acne":0-100,"oiliness":0-100,"hydration":0-100,"redness":0-100,"pores":0-100,"darkSpots":0-100,"texture":0-100,"fineLines":0-100},
 "concerns": string[] (زیرمجموعه‌ای از کلیدهای metrics با امتیاز زیر ۵۰),
 "topOpportunities": string[] (دو کلید با بیشترین فرصت بهبود),
 "confidence": number (0 تا 1),
 "observations": string[] (۳ تا ۶ جمله فارسی),
 "limitations": string[] (حتماً ذکر کن این ارزیابی ظاهری/کازمتیک است نه تشخیص پزشکی),
 "recommendedNextStep": string
}
اگر عکس نامناسب است (چهره نامشخص/تار/چند چهره)، imageQuality.suitable را false کن، دلیل را در issues بگذار، بقیه فیلدها را ۵۰/خنثی بگذار.`;

export async function analyzeSkinWithOpenRouter(imageDataUrl, apiKey) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  let response;
  try {
    response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'http://localhost',
        'X-Title': 'Poosta Skin Analysis',
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: PROMPT },
            { type: 'image_url', image_url: { url: imageDataUrl } },
          ],
        }],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    throw new Error(`OpenRouter API error ${response.status}: ${errBody.slice(0, 300)}`);
  }
  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('OpenRouter returned no content');
  const jsonText = text.trim().replace(/^```json\s*|\s*```$/g, ''); // some free models wrap output in fences despite instructions
  const parsed = JSON.parse(jsonText);
  for (const k of METRIC_KEYS) if (parsed.metrics?.[k] === undefined) parsed.metrics = { ...parsed.metrics, [k]: 50 };
  return { ...parsed, provider: `openrouter:${OPENROUTER_MODEL}`, createdAt: new Date().toISOString() };
}
