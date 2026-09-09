/**
 * Builds private training assets for a scan.
 * NEVER triggers model training — operator runs ai:train manually later.
 */
import { getStorage, parseDataUrl } from './storage.mjs';
import { scanObjectPrefix } from './storage.mjs';

function boxesFromAnalysis(analysisResult) {
  const boxes = [];
  const list = analysisResult?.annotationBoxes;
  if (Array.isArray(list)) {
    for (const b of list) {
      if (b && Number.isFinite(b.x) && Number.isFinite(b.y) && Number.isFinite(b.w) && Number.isFinite(b.h)) {
        boxes.push({
          label: String(b.label || 'region'),
          x: Math.round(b.x),
          y: Math.round(b.y),
          w: Math.round(b.w),
          h: Math.round(b.h),
          source: b.source || 'ai',
          conf: typeof b.conf === 'number' ? b.conf : undefined,
        });
      }
    }
  }
  const face = analysisResult?.imageQuality?.faceBox;
  if (face && Number.isFinite(face.x) && !boxes.some((b) => b.label === 'face')) {
    boxes.push({
      label: 'face',
      x: Math.round(face.x),
      y: Math.round(face.y),
      w: Math.round(face.w),
      h: Math.round(face.h),
      source: analysisResult?.imageQuality?.faceMethod || 'face',
    });
  }
  return boxes;
}

async function drawOverlay(originalBuffer, boxes) {
  if (!boxes.length) return null;
  try {
    const sharp = (await import('sharp')).default;
    const image = sharp(originalBuffer);
    const meta = await image.metadata();
    const width = meta.width || 1;
    const height = meta.height || 1;

    const rects = boxes.map((b) => {
      const left = Math.max(0, Math.min(width - 1, b.x));
      const top = Math.max(0, Math.min(height - 1, b.y));
      const rw = Math.max(1, Math.min(width - left, b.w));
      const rh = Math.max(1, Math.min(height - top, b.h));
      return `<rect x="${left}" y="${top}" width="${rw}" height="${rh}" fill="none" stroke="#E11D48" stroke-width="3"/>
        <text x="${left + 4}" y="${Math.max(14, top - 6)}" fill="#E11D48" font-size="18" font-family="sans-serif">${escapeXml(b.label)}</text>`;
    }).join('\n');

    const svg = Buffer.from(
      `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`,
    );

    return await image
      .composite([{ input: svg, top: 0, left: 0 }])
      .jpeg({ quality: 90 })
      .toBuffer();
  } catch (err) {
    console.warn('[annotate] sharp overlay skipped:', err.message);
    return null;
  }
}

function escapeXml(s) {
  return String(s).replace(/[<>&'"]/g, (c) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;',
  }[c]));
}

export async function buildAndStoreAnnotations({ scan, analysisResult, mode }) {
  const storage = getStorage();
  const prefix = scan.original_key
    ? scan.original_key.replace(/\/original\.jpg$/, '')
    : scanObjectPrefix(scan.id);

  let originalBuffer = await storage.get(scan.original_key);
  if (!originalBuffer && analysisResult?.imageDataUrl) {
    originalBuffer = parseDataUrl(analysisResult.imageDataUrl).buffer;
  }
  if (!originalBuffer) {
    throw new Error('Original image missing for annotation');
  }

  const boxes = boxesFromAnalysis(analysisResult);
  const annotations = {
    scan_id: scan.id,
    pharmacy_id: scan.pharmacy_id,
    device_id: scan.device_id,
    mode,
    provider: analysisResult?.providerUsed || analysisResult?.provider || null,
    created_at: new Date().toISOString(),
    metrics: analysisResult?.metrics || null,
    overallScore: analysisResult?.overallScore,
    concerns: analysisResult?.concerns || [],
    observations: analysisResult?.observations || [],
    confidence: analysisResult?.confidence,
    boxes,
    training: {
      schema_version: analysisResult?.trainingMeta?.schemaVersion || 1,
      label_source: analysisResult?.trainingMeta?.labelSource || 'model_output',
      review_status: analysisResult?.trainingMeta?.reviewStatus || 'unreviewed',
      provider: analysisResult?.trainingMeta?.provider || null,
      model: analysisResult?.trainingMeta?.model || null,
      provider_response_id: analysisResult?.trainingMeta?.responseId || null,
      image_width: analysisResult?.trainingMeta?.imageWidth || null,
      image_height: analysisResult?.trainingMeta?.imageHeight || null,
    },
    note: 'AI pseudo-labels must be reviewed by a qualified human before training. Training is never started automatically.',
  };

  const annotationsKey = `${prefix}/annotations.json`;
  await storage.put(annotationsKey, JSON.stringify(annotations, null, 2));

  let overlayKey = null;
  const overlayBuffer = await drawOverlay(originalBuffer, boxes);
  if (overlayBuffer) {
    overlayKey = `${prefix}/overlay.jpg`;
    await storage.put(overlayKey, overlayBuffer);
  }

  return { annotationsKey, overlayKey, boxCount: boxes.length };
}
