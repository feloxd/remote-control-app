const { app, nativeImage } = require('electron');
const ort = require('onnxruntime-node');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

const MODEL_SIZE = 320;
const LABELS = [
  'FEMALE_GENITALIA_COVERED',
  'FACE_FEMALE',
  'BUTTOCKS_EXPOSED',
  'FEMALE_BREAST_EXPOSED',
  'FEMALE_GENITALIA_EXPOSED',
  'MALE_BREAST_EXPOSED',
  'ANUS_EXPOSED',
  'FEET_EXPOSED',
  'BELLY_COVERED',
  'FEET_COVERED',
  'ARMPITS_COVERED',
  'ARMPITS_EXPOSED',
  'FACE_MALE',
  'BELLY_EXPOSED',
  'MALE_GENITALIA_EXPOSED',
  'ANUS_COVERED',
  'FEMALE_BREAST_COVERED',
  'BUTTOCKS_COVERED',
];

const DEFAULT_CENSOR_CLASSES = new Set([
  'BUTTOCKS_EXPOSED',
  'FEMALE_BREAST_EXPOSED',
  'FEMALE_GENITALIA_EXPOSED',
  'ANUS_EXPOSED',
  'MALE_GENITALIA_EXPOSED',
]);

function parseArgs(argv) {
  const options = {
    imagePath: '',
    modelPath: path.join(__dirname, 'models', 'nudenet-320n.onnx'),
    outputDir: path.join(__dirname, 'out'),
    confidence: 0.25,
    iou: 0.45,
    runs: 3,
    pixelSize: 18,
    padding: 0.08,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--') && !options.imagePath) options.imagePath = arg;
    else if (arg === '--image') options.imagePath = argv[++i] || '';
    else if (arg === '--model') options.modelPath = argv[++i] || '';
    else if (arg === '--output') options.outputDir = argv[++i] || '';
    else if (arg === '--confidence') options.confidence = Number(argv[++i]);
    else if (arg === '--iou') options.iou = Number(argv[++i]);
    else if (arg === '--runs') options.runs = Number(argv[++i]);
    else if (arg === '--pixel-size') options.pixelSize = Number(argv[++i]);
    else if (arg === '--padding') options.padding = Number(argv[++i]);
    else if (arg === '--help' || arg === '-h') options.help = true;
  }

  options.imagePath = options.imagePath ? path.resolve(options.imagePath) : '';
  options.modelPath = path.resolve(options.modelPath);
  options.outputDir = path.resolve(options.outputDir);
  options.confidence = Math.min(1, Math.max(0.01, options.confidence || 0.25));
  options.iou = Math.min(1, Math.max(0.01, options.iou || 0.45));
  options.runs = Math.min(20, Math.max(1, Math.round(options.runs || 3)));
  options.pixelSize = Math.min(80, Math.max(4, Math.round(options.pixelSize || 18)));
  options.padding = Math.min(0.5, Math.max(0, options.padding || 0.08));
  return options;
}

function printHelp() {
  console.log([
    'Regional AI censor proof of concept',
    '',
    'Usage:',
    '  npm run poc:censor --workspace=@remote-control/desktop-client -- --image <file>',
    '',
    'Options:',
    '  --confidence <0..1>  Detection threshold (default: 0.25)',
    '  --iou <0..1>         Non-maximum suppression threshold (default: 0.45)',
    '  --runs <n>           Timed inference runs (default: 3)',
    '  --pixel-size <px>    Pixel block size (default: 18)',
    '  --padding <ratio>    Extra area around detections (default: 0.08)',
    '  --output <dir>       Output directory',
  ].join('\n'));
}

function prepareInput(image) {
  const originalSize = image.getSize();
  const maxSide = Math.max(originalSize.width, originalSize.height);
  const width = Math.max(1, Math.round((originalSize.width / maxSide) * MODEL_SIZE));
  const height = Math.max(1, Math.round((originalSize.height / maxSide) * MODEL_SIZE));
  const resized = image.resize({ width, height, quality: 'best' });
  const bitmap = resized.toBitmap();
  const plane = MODEL_SIZE * MODEL_SIZE;
  const input = new Float32Array(plane * 3);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const source = (y * width + x) * 4;
      const target = y * MODEL_SIZE + x;
      // Electron returns native bitmap pixels in BGRA order on Windows.
      input[target] = bitmap[source + 2] / 255;
      input[plane + target] = bitmap[source + 1] / 255;
      input[plane * 2 + target] = bitmap[source] / 255;
    }
  }

  return {
    tensor: new ort.Tensor('float32', input, [1, 3, MODEL_SIZE, MODEL_SIZE]),
    originalSize,
    maxSide,
  };
}

function outputAccessor(tensor) {
  const dims = tensor.dims.map(Number);
  if (dims.length !== 3 || dims[0] !== 1) {
    throw new Error(`Unexpected model output dimensions: ${JSON.stringify(dims)}`);
  }

  if (dims[1] === LABELS.length + 4) {
    const channels = dims[1];
    const candidates = dims[2];
    return {
      dims,
      candidates,
      get: (candidate, channel) => tensor.data[channel * candidates + candidate],
      channels,
    };
  }

  if (dims[2] === LABELS.length + 4) {
    const candidates = dims[1];
    const channels = dims[2];
    return {
      dims,
      candidates,
      get: (candidate, channel) => tensor.data[candidate * channels + channel],
      channels,
    };
  }

  throw new Error(`Model output does not contain ${LABELS.length + 4} channels: ${JSON.stringify(dims)}`);
}

function intersectionOverUnion(a, b) {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  if (!intersection) return 0;
  return intersection / (a.width * a.height + b.width * b.height - intersection);
}

function nonMaximumSuppression(detections, threshold) {
  const ordered = [...detections].sort((a, b) => b.score - a.score);
  const kept = [];
  for (const detection of ordered) {
    if (kept.some((existing) => intersectionOverUnion(existing.box, detection.box) > threshold)) continue;
    kept.push(detection);
  }
  return kept;
}

function parseDetections(tensor, inputMeta, confidence, iou) {
  const output = outputAccessor(tensor);
  const detections = [];
  const { width: imageWidth, height: imageHeight } = inputMeta.originalSize;

  for (let candidate = 0; candidate < output.candidates; candidate++) {
    let classId = -1;
    let score = -Infinity;
    for (let index = 0; index < LABELS.length; index++) {
      const value = output.get(candidate, index + 4);
      if (value > score) {
        classId = index;
        score = value;
      }
    }
    if (score < confidence) continue;

    const centerX = output.get(candidate, 0) * inputMeta.maxSide / MODEL_SIZE;
    const centerY = output.get(candidate, 1) * inputMeta.maxSide / MODEL_SIZE;
    const rawWidth = output.get(candidate, 2) * inputMeta.maxSide / MODEL_SIZE;
    const rawHeight = output.get(candidate, 3) * inputMeta.maxSide / MODEL_SIZE;
    const x = Math.max(0, Math.min(imageWidth, centerX - rawWidth / 2));
    const y = Math.max(0, Math.min(imageHeight, centerY - rawHeight / 2));
    const width = Math.max(0, Math.min(rawWidth, imageWidth - x));
    const height = Math.max(0, Math.min(rawHeight, imageHeight - y));
    if (width < 2 || height < 2) continue;

    detections.push({
      class: LABELS[classId],
      classId,
      score,
      box: { x, y, width, height },
    });
  }

  return {
    outputDimensions: output.dims,
    candidates: output.candidates,
    detections: nonMaximumSuppression(detections, iou).map((detection) => ({
      ...detection,
      score: Number(detection.score.toFixed(4)),
      box: Object.fromEntries(
        Object.entries(detection.box).map(([key, value]) => [key, Math.round(value)]),
      ),
    })),
  };
}

function expandBox(box, imageSize, padding) {
  const padX = box.width * padding;
  const padY = box.height * padding;
  const x = Math.max(0, Math.floor(box.x - padX));
  const y = Math.max(0, Math.floor(box.y - padY));
  const right = Math.min(imageSize.width, Math.ceil(box.x + box.width + padX));
  const bottom = Math.min(imageSize.height, Math.ceil(box.y + box.height + padY));
  return { x, y, width: right - x, height: bottom - y };
}

function pixelateRegion(bitmap, imageWidth, box, pixelSize) {
  const right = box.x + box.width;
  const bottom = box.y + box.height;
  for (let blockY = box.y; blockY < bottom; blockY += pixelSize) {
    for (let blockX = box.x; blockX < right; blockX += pixelSize) {
      const blockRight = Math.min(right, blockX + pixelSize);
      const blockBottom = Math.min(bottom, blockY + pixelSize);
      let blue = 0;
      let green = 0;
      let red = 0;
      let alpha = 0;
      let count = 0;
      for (let y = blockY; y < blockBottom; y++) {
        for (let x = blockX; x < blockRight; x++) {
          const offset = (y * imageWidth + x) * 4;
          blue += bitmap[offset];
          green += bitmap[offset + 1];
          red += bitmap[offset + 2];
          alpha += bitmap[offset + 3];
          count++;
        }
      }
      blue = Math.round(blue / count);
      green = Math.round(green / count);
      red = Math.round(red / count);
      alpha = Math.round(alpha / count);
      for (let y = blockY; y < blockBottom; y++) {
        for (let x = blockX; x < blockRight; x++) {
          const offset = (y * imageWidth + x) * 4;
          bitmap[offset] = blue;
          bitmap[offset + 1] = green;
          bitmap[offset + 2] = red;
          bitmap[offset + 3] = alpha;
        }
      }
    }
  }
}

function writePreview(image, detections, outputPath, options) {
  const imageSize = image.getSize();
  const bitmap = Buffer.from(image.toBitmap());
  const applied = [];
  for (const detection of detections) {
    if (!DEFAULT_CENSOR_CLASSES.has(detection.class)) continue;
    const box = expandBox(detection.box, imageSize, options.padding);
    pixelateRegion(bitmap, imageSize.width, box, options.pixelSize);
    applied.push({ ...detection, appliedBox: box });
  }
  const preview = nativeImage.createFromBitmap(bitmap, {
    width: imageSize.width,
    height: imageSize.height,
    scaleFactor: 1,
  });
  fs.writeFileSync(outputPath, preview.toPNG());
  return applied;
}

async function run() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help || !options.imagePath) {
    printHelp();
    if (!options.help) process.exitCode = 2;
    return;
  }
  if (!fs.existsSync(options.imagePath)) throw new Error(`Image not found: ${options.imagePath}`);
  if (!fs.existsSync(options.modelPath)) throw new Error(`Model not found: ${options.modelPath}`);

  const image = nativeImage.createFromPath(options.imagePath);
  if (image.isEmpty()) throw new Error(`Electron could not decode: ${options.imagePath}`);
  const input = prepareInput(image);

  const loadStarted = performance.now();
  const session = await ort.InferenceSession.create(options.modelPath, {
    executionProviders: ['cpu'],
    graphOptimizationLevel: 'all',
  });
  const modelLoadMs = performance.now() - loadStarted;
  const inputName = session.inputNames[0];
  const inferenceMs = [];
  let result;

  for (let runIndex = 0; runIndex < options.runs; runIndex++) {
    const started = performance.now();
    result = await session.run({ [inputName]: input.tensor });
    inferenceMs.push(performance.now() - started);
  }

  const outputTensor = result[session.outputNames[0]];
  const parsed = parseDetections(outputTensor, input, options.confidence, options.iou);
  fs.mkdirSync(options.outputDir, { recursive: true });
  const baseName = path.parse(options.imagePath).name.replace(/[^a-z0-9_-]+/gi, '-');
  const previewPath = path.join(options.outputDir, `${baseName}-censored-poc.png`);
  const reportPath = path.join(options.outputDir, `${baseName}-detections.json`);
  const censoredDetections = writePreview(image, parsed.detections, previewPath, options);
  const averageInferenceMs = inferenceMs.reduce((sum, value) => sum + value, 0) / inferenceMs.length;

  const report = {
    proofOfConcept: true,
    productionReady: false,
    image: { path: options.imagePath, ...input.originalSize },
    model: {
      path: options.modelPath,
      inputSize: MODEL_SIZE,
      outputDimensions: parsed.outputDimensions,
      candidateBoxes: parsed.candidates,
    },
    thresholds: { confidence: options.confidence, iou: options.iou },
    timing: {
      modelLoadMs: Number(modelLoadMs.toFixed(2)),
      inferenceRunsMs: inferenceMs.map((value) => Number(value.toFixed(2))),
      averageInferenceMs: Number(averageInferenceMs.toFixed(2)),
      theoreticalFps: Number((1000 / averageInferenceMs).toFixed(2)),
    },
    detections: parsed.detections,
    censoredDetections,
    output: previewPath,
  };

  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    detections: report.detections.length,
    censoredRegions: report.censoredDetections.length,
    timing: report.timing,
    preview: previewPath,
    report: reportPath,
  }, null, 2));
}

app.whenReady()
  .then(run)
  .catch((error) => {
    console.error(`[ai-censor-poc] ${error.stack || error.message}`);
    process.exitCode = 1;
  })
  .finally(() => app.quit());
