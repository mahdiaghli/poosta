/**
 * imageAnalysis — real (non-random) pixel-level helpers shared by the image
 * quality check and the skin heuristic. This is NOT a face-detection or
 * dermatological model — it's a deterministic proxy (brightness, contrast,
 * sharpness-by-edge-variance, redness/warmth ratio) so results are at least
 * stable and image-derived instead of Math.random(). See skinAnalysisService
 * for the real-provider swap point (#1, #2, #3 from the review).
 */
export interface PixelStats {
  width: number; height: number;
  meanBrightness: number;   // 0-255
  contrast: number;         // stddev of brightness, 0-255
  sharpness: number;        // mean absolute Laplacian, higher = sharper
  redness: number;          // mean(R - G) normalized 0-100
  warmth: number;           // mean(R - B) normalized 0-100
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function analyzePixels(src: string): Promise<PixelStats> {
  const img = await loadImage(src);
  const size = 200; // downscale for fast, consistent analysis
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);

  const gray = new Float32Array(size * size);
  let sumR = 0, sumG = 0, sumB = 0, sumGray = 0;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    const g0 = 0.299 * r + 0.587 * g + 0.114 * b;
    gray[p] = g0;
    sumGray += g0; sumR += r; sumG += g; sumB += b;
  }
  const n = size * size;
  const meanBrightness = sumGray / n;

  let varSum = 0;
  for (let p = 0; p < n; p++) varSum += (gray[p] - meanBrightness) ** 2;
  const contrast = Math.sqrt(varSum / n);

  // simple Laplacian edge-energy as a sharpness/blur proxy
  let edgeSum = 0, edgeCount = 0;
  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      const idx = y * size + x;
      const lap = 4 * gray[idx] - gray[idx - 1] - gray[idx + 1] - gray[idx - size] - gray[idx + size];
      edgeSum += Math.abs(lap); edgeCount++;
    }
  }
  const sharpness = edgeSum / edgeCount;

  const redness = Math.max(0, Math.min(100, ((sumR - sumG) / n) * 1.5));
  const warmth = Math.max(0, Math.min(100, ((sumR - sumB) / n) * 1.5));

  return { width: img.naturalWidth, height: img.naturalHeight, meanBrightness, contrast, sharpness, redness, warmth };
}
