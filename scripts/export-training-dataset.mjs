import '../server/loadEnv.mjs';

/**
 * Export collected private scan assets into a portable, versioned dataset.
 * This command never trains a model. AI pseudo-labels remain marked unreviewed.
 */
import fs from 'node:fs';
import path from 'node:path';

const dataRoot = path.resolve(process.env.POOSTA_DATA_DIR || 'data');
const scansRoot = path.join(dataRoot, 'scans');
const reviewedOnly = process.argv.includes('--reviewed-only');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outRoot = path.join(dataRoot, 'exports', `poosta_dataset_${stamp}`);
const imagesRoot = path.join(outRoot, 'images');
const labelsRoot = path.join(outRoot, 'annotations');

function walk(directory, filename, found = []) {
  if (!fs.existsSync(directory)) return found;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full, filename, found);
    else if (entry.name === filename) found.push(full);
  }
  return found;
}

function csv(value) {
  const text = value == null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const annotationFiles = walk(scansRoot, 'annotations.json');
const samples = [];
for (const annotationPath of annotationFiles) {
  let annotation;
  try {
    annotation = JSON.parse(fs.readFileSync(annotationPath, 'utf8'));
  } catch (error) {
    console.warn(`Skipping invalid annotation ${annotationPath}: ${error.message}`);
    continue;
  }
  const reviewStatus = annotation?.training?.review_status || 'unreviewed';
  if (reviewedOnly && reviewStatus !== 'reviewed') continue;
  const originalPath = path.join(path.dirname(annotationPath), 'original.jpg');
  if (!fs.existsSync(originalPath)) {
    console.warn(`Skipping ${annotation.scan_id || annotationPath}: original.jpg is missing`);
    continue;
  }
  samples.push({ annotation, annotationPath, originalPath, reviewStatus });
}

if (!samples.length) {
  console.log(reviewedOnly
    ? 'No reviewed samples found. Review annotations and set training.review_status to "reviewed" first.'
    : `No completed scan annotations found under ${scansRoot}.`);
  process.exit(0);
}

fs.mkdirSync(imagesRoot, { recursive: true });
fs.mkdirSync(labelsRoot, { recursive: true });

const manifest = [];
const metricKeys = ['acne', 'oiliness', 'hydration', 'redness', 'pores', 'darkSpots', 'texture', 'fineLines'];
const csvRows = [[
  'scan_id', 'image', 'annotation', 'provider', 'review_status', 'overall_score',
  ...metricKeys, 'confidence', 'created_at',
]];

for (const sample of samples) {
  const scanId = String(sample.annotation.scan_id || `sample_${manifest.length + 1}`).replace(/[^A-Za-z0-9_-]/g, '_');
  const imageName = `${scanId}.jpg`;
  const annotationName = `${scanId}.json`;
  const imageRelative = `images/${imageName}`;
  const annotationRelative = `annotations/${annotationName}`;
  fs.copyFileSync(sample.originalPath, path.join(imagesRoot, imageName));
  fs.copyFileSync(sample.annotationPath, path.join(labelsRoot, annotationName));

  manifest.push({
    scan_id: scanId,
    image: imageRelative,
    annotation: annotationRelative,
    provider: sample.annotation.provider || null,
    review_status: sample.reviewStatus,
    label_source: sample.annotation?.training?.label_source || 'unknown',
    metrics: sample.annotation.metrics || null,
    boxes: sample.annotation.boxes || [],
  });
  csvRows.push([
    scanId,
    imageRelative,
    annotationRelative,
    sample.annotation.provider || '',
    sample.reviewStatus,
    sample.annotation.overallScore ?? '',
    ...metricKeys.map((key) => sample.annotation.metrics?.[key] ?? ''),
    sample.annotation.confidence ?? '',
    sample.annotation.created_at || '',
  ]);
}

fs.writeFileSync(path.join(outRoot, 'manifest.jsonl'), `${manifest.map((row) => JSON.stringify(row)).join('\n')}\n`);
fs.writeFileSync(path.join(outRoot, 'metrics.csv'), `${csvRows.map((row) => row.map(csv).join(',')).join('\n')}\n`);
fs.writeFileSync(path.join(outRoot, 'README.txt'), [
  'Poosta private training export',
  `Created: ${new Date().toISOString()}`,
  `Samples: ${manifest.length}`,
  '',
  'AI-generated annotations are pseudo-labels. Review them before model training.',
  'This export contains identifiable face images and must be stored securely.',
].join('\n'));

console.log(`Exported ${manifest.length} samples to ${outRoot}`);
