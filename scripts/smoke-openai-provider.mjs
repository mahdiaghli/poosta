import assert from 'node:assert/strict';

const metrics = {
  acne: 72, oiliness: 65, hydration: 58, redness: 80,
  pores: 61, darkSpots: 77, texture: 69, fineLines: 84,
};
const providerPayload = {
  imageQuality: {
    suitable: true, faceDetected: true, faceCount: 1, frontal: true,
    faceVisibility: 'clear', qualityScore: 88, issues: [],
  },
  overallScore: 71,
  metrics,
  concerns: [],
  topOpportunities: ['hydration', 'pores'],
  confidence: 0.82,
  observations: ['بافت پوست قابل مشاهده است.', 'نور تصویر مناسب است.'],
  limitations: ['این ارزیابی ظاهری است و تشخیص پزشکی نیست.'],
  recommendedNextStep: 'از روتین ملایم استفاده شود.',
  apparentSkinAge: 29,
  apparentSkinAgeNote: 'این فقط برآورد ظاهری پوست است.',
  annotationBoxes: [{ label: 'enlarged_pores', x: 100, y: 100, w: 200, h: 150, conf: 0.74, source: 'openai' }],
};

let request;
globalThis.fetch = async (url, options) => {
  request = { url, options, body: JSON.parse(options.body) };
  return new Response(JSON.stringify({
    id: 'resp_smoke',
    output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(providerPayload) }] }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

const { analyzeSkinWithOpenAI } = await import('../openai-skin-analysis.js');
const result = await analyzeSkinWithOpenAI('data:image/jpeg;base64,AA==', 'test-key-not-sent-to-browser');

assert.equal(request.url, 'https://api.openai.com/v1/responses');
assert.equal(request.body.store, false);
assert.equal(request.body.input[0].content[1].type, 'input_image');
assert.equal(request.body.text.format.type, 'json_schema');
assert.equal(request.body.text.format.strict, true);
assert.equal(result.overallScore, 71);
assert.equal(result.metrics.hydration, 58);
assert.equal(result.trainingMeta.reviewStatus, 'unreviewed');
assert.equal(result.trainingMeta.responseId, 'resp_smoke');
assert.equal(result.annotationBoxes.length, 1);

console.log('OpenAI provider smoke passed (network mocked).');

