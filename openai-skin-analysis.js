/**
 * OpenAI vision provider for cloud skin appearance analysis.
 * Server-side only: OPENAI_API_KEY must never be exposed to the browser.
 */

const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5';
const OPENAI_URL = 'https://api.openai.com/v1/responses';
const METRIC_KEYS = ['acne', 'oiliness', 'hydration', 'redness', 'pores', 'darkSpots', 'texture', 'fineLines'];
const BOX_LABELS = ['acne', 'redness', 'dark_spot', 'enlarged_pores', 'fine_lines', 'dry_texture'];

const scoreProperties = Object.fromEntries(
  METRIC_KEYS.map((key) => [key, { type: 'integer', minimum: 0, maximum: 100 }]),
);

const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    imageQuality: {
      type: 'object',
      additionalProperties: false,
      properties: {
        suitable: { type: 'boolean' },
        faceDetected: { type: 'boolean' },
        faceCount: { type: 'integer', minimum: 0, maximum: 5 },
        frontal: { type: 'boolean' },
        faceVisibility: { type: 'string', enum: ['clear', 'partial', 'poor'] },
        qualityScore: { type: 'integer', minimum: 0, maximum: 100 },
        issues: { type: 'array', items: { type: 'string' }, maxItems: 6 },
      },
      required: ['suitable', 'faceDetected', 'faceCount', 'frontal', 'faceVisibility', 'qualityScore', 'issues'],
    },
    overallScore: { type: 'integer', minimum: 0, maximum: 100 },
    metrics: {
      type: 'object',
      additionalProperties: false,
      properties: scoreProperties,
      required: METRIC_KEYS,
    },
    concerns: { type: 'array', items: { type: 'string', enum: METRIC_KEYS }, maxItems: 8 },
    topOpportunities: { type: 'array', items: { type: 'string', enum: METRIC_KEYS }, maxItems: 3 },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    observations: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 6 },
    limitations: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 5 },
    recommendedNextStep: { type: 'string' },
    apparentSkinAge: { type: 'integer', minimum: 18, maximum: 70 },
    apparentSkinAgeNote: { type: 'string' },
    annotationBoxes: {
      type: 'array',
      maxItems: 20,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          label: { type: 'string', enum: BOX_LABELS },
          x: { type: 'integer', minimum: 0 },
          y: { type: 'integer', minimum: 0 },
          w: { type: 'integer', minimum: 1 },
          h: { type: 'integer', minimum: 1 },
          conf: { type: 'number', minimum: 0, maximum: 1 },
          source: { type: 'string', enum: ['openai'] },
        },
        required: ['label', 'x', 'y', 'w', 'h', 'conf', 'source'],
      },
    },
  },
  required: [
    'imageQuality', 'overallScore', 'metrics', 'concerns', 'topOpportunities',
    'confidence', 'observations', 'limitations', 'recommendedNextStep',
    'apparentSkinAge', 'apparentSkinAgeNote', 'annotationBoxes',
  ],
};

function clamp(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

async function imageSize(base64) {
  try {
    const sharp = (await import('sharp')).default;
    const metadata = await sharp(Buffer.from(base64, 'base64')).metadata();
    return { width: metadata.width || 1000, height: metadata.height || 1000 };
  } catch {
    return { width: 1000, height: 1000 };
  }
}

function responseText(data) {
  if (typeof data?.output_text === 'string') return data.output_text;
  for (const item of data?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === 'output_text' && typeof content.text === 'string') return content.text;
      if (content?.type === 'refusal') throw new Error(`OpenAI refused the image analysis: ${content.refusal || 'unknown reason'}`);
    }
  }
  return '';
}

function normalize(parsed, dimensions, responseId) {
  const metrics = Object.fromEntries(
    METRIC_KEYS.map((key) => [key, Math.round(clamp(parsed?.metrics?.[key], 0, 100, 50))]),
  );
  const boxes = Array.isArray(parsed?.annotationBoxes)
    ? parsed.annotationBoxes.flatMap((box) => {
      if (!BOX_LABELS.includes(box?.label)) return [];
      const x = Math.round(clamp(box.x, 0, dimensions.width - 1, 0));
      const y = Math.round(clamp(box.y, 0, dimensions.height - 1, 0));
      const w = Math.round(clamp(box.w, 1, dimensions.width - x, 1));
      const h = Math.round(clamp(box.h, 1, dimensions.height - y, 1));
      return [{ label: box.label, x, y, w, h, conf: clamp(box.conf, 0, 1, 0.5), source: 'openai' }];
    })
    : [];

  return {
    ...parsed,
    metrics,
    overallScore: Math.round(clamp(parsed?.overallScore, 0, 100, 50)),
    confidence: clamp(parsed?.confidence, 0, 1, 0.5),
    annotationBoxes: boxes,
    provider: `openai:${OPENAI_MODEL}`,
    createdAt: new Date().toISOString(),
    trainingMeta: {
      schemaVersion: 1,
      labelSource: 'ai_pseudo_label',
      reviewStatus: 'unreviewed',
      provider: 'openai',
      model: OPENAI_MODEL,
      responseId: responseId || null,
      imageWidth: dimensions.width,
      imageHeight: dimensions.height,
    },
  };
}

export async function analyzeSkinWithOpenAI(imageDataUrl, apiKey) {
  const match = /^data:(image\/[\w+.-]+);base64,(.+)$/s.exec(imageDataUrl || '');
  if (!match) throw new Error('Invalid image data URL');
  const dimensions = await imageSize(match[2]);

  const prompt = `You are a cautious cosmetic skin-appearance annotator, not a doctor.
Analyze only visible evidence in this single frontal face image. Never diagnose a disease or infer protected/sensitive traits.
Image dimensions are ${dimensions.width}x${dimensions.height} pixels.

Scoring rules:
- Return all eight metric scores from 0 to 100, where 100 always means the best/healthiest-looking visible condition.
- Be conservative about hydration and oiliness because a photo cannot measure them directly; reflect uncertainty in confidence and limitations.
- overallScore must be a reasoned weighted score, not an unexplained copy of one metric.
- concerns are metric keys below 50; topOpportunities are the two or three clearest areas for cosmetic improvement.
- Write observations, limitations, next step, and apparentSkinAgeNote in Persian.
- apparentSkinAge is cosmetic appearance only, never the person's real age.
- If the image is unsuitable, set imageQuality.suitable=false, explain why in Persian, and use neutral scores.

Annotation rules:
- Add tight pixel-coordinate boxes only around clearly visible cosmetic regions.
- x/y are the top-left pixel; w/h are pixel width/height within the stated image dimensions.
- Do not invent boxes for uncertain findings. These labels are AI pseudo-labels and will be human-reviewed before training.`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  let response;
  try {
    response = await fetch(OPENAI_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        store: false,
        input: [{
          role: 'user',
          content: [
            { type: 'input_text', text: prompt },
            { type: 'input_image', image_url: imageDataUrl, detail: 'high' },
          ],
        }],
        text: {
          format: {
            type: 'json_schema',
            name: 'poosta_skin_analysis',
            strict: true,
            schema: RESPONSE_SCHEMA,
          },
        },
        max_output_tokens: 2400,
      }),
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`OpenAI API error ${response.status}: ${errorBody.slice(0, 500)}`);
  }
  const data = await response.json();
  const text = responseText(data);
  if (!text) throw new Error('OpenAI returned no structured analysis');
  return normalize(JSON.parse(text), dimensions, data.id);
}

