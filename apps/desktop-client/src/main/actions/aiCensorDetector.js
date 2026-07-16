const { app } = require('electron');
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

const EXPLICIT_CLASSES = new Set([
  'BUTTOCKS_EXPOSED',
  'FEMALE_BREAST_EXPOSED',
  'FEMALE_GENITALIA_EXPOSED',
  'ANUS_EXPOSED',
  'MALE_GENITALIA_EXPOSED',
]);

let runtime = null;
let sessionPromise = null;
let loadedModelPath = '';

function modelCandidates(explicitPath) {
  const candidates = [
    explicitPath,
    process.env.CENSOR_MODEL_PATH,
    app.isPackaged ? path.join(process.resourcesPath, 'models', 'nudenet-320n.onnx') : '',
    !app.isPackaged ? path.join(app.getAppPath(), 'test', 'models', 'nudenet-320n.onnx') : '',
    !app.isPackaged ? path.join(__dirname, '..', '..', '..', 'test', 'models', 'nudenet-320n.onnx') : '',
  ];
  return [...new Set(candidates.filter(Boolean).map((candidate) => path.resolve(candidate)))];
}

function resolveModelPath(explicitPath) {
  const modelPath = modelCandidates(explicitPath).find((candidate) => fs.existsSync(candidate));
  if (!modelPath) {
    throw new Error(
      'AI censor model not found. Set CENSOR_MODEL_PATH or place nudenet-320n.onnx in test/models.',
    );
  }
  return modelPath;
}

async function getSession(explicitPath) {
  const modelPath = resolveModelPath(explicitPath);
  if (sessionPromise && loadedModelPath === modelPath) {
    return { session: await sessionPromise, modelPath };
  }

  try {
    runtime ||= require('onnxruntime-node');
  } catch (error) {
    throw new Error(`onnxruntime-node is unavailable: ${error.message}`);
  }

  loadedModelPath = modelPath;
  sessionPromise = runtime.InferenceSession.create(modelPath, {
    executionProviders: ['cpu'],
    graphOptimizationLevel: 'all',
  }).catch((error) => {
    sessionPromise = null;
    loadedModelPath = '';
    throw error;
  });
  return { session: await sessionPromise, modelPath };
}

function prepareInput(image) {
  const size = image.getSize();
  if (!size.width || !size.height) throw new Error('Cannot run AI censor on an empty frame');
  const maxSide = Math.max(size.width, size.height);
  const width = Math.max(1, Math.round((size.width / maxSide) * MODEL_SIZE));
  const height = Math.max(1, Math.round((size.height / maxSide) * MODEL_SIZE));
  const resized = image.resize({ width, height, quality: 'good' });
  const bitmap = resized.toBitmap();
  const plane = MODEL_SIZE * MODEL_SIZE;
  const values = new Float32Array(plane * 3);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const source = (y * width + x) * 4;
      const target = y * MODEL_SIZE + x;
      values[target] = bitmap[source + 2] / 255;
      values[plane + target] = bitmap[source + 1] / 255;
      values[plane * 2 + target] = bitmap[source] / 255;
    }
  }

  return {
    tensor: new runtime.Tensor('float32', values, [1, 3, MODEL_SIZE, MODEL_SIZE]),
    size,
    maxSide,
  };
}

function outputAccessor(tensor) {
  const dims = tensor.dims.map(Number);
  const channels = LABELS.length + 4;
  if (dims.length !== 3 || dims[0] !== 1) {
    throw new Error(`Unexpected AI censor output: ${JSON.stringify(dims)}`);
  }
  if (dims[1] === channels) {
    return {
      candidates: dims[2],
      get: (candidate, channel) => tensor.data[channel * dims[2] + candidate],
    };
  }
  if (dims[2] === channels) {
    return {
      candidates: dims[1],
      get: (candidate, channel) => tensor.data[candidate * dims[2] + channel],
    };
  }
  throw new Error(`AI censor output is missing ${channels} channels: ${JSON.stringify(dims)}`);
}

function iou(a, b) {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  if (!intersection) return 0;
  return intersection / (a.w * a.h + b.w * b.h - intersection);
}

function suppressOverlaps(detections, threshold) {
  const ordered = [...detections].sort((a, b) => b.score - a.score);
  const kept = [];
  for (const detection of ordered) {
    if (kept.some((existing) => iou(existing, detection) > threshold)) continue;
    kept.push(detection);
  }
  return kept;
}

function parseDetections(tensor, input, confidence, nmsThreshold) {
  const output = outputAccessor(tensor);
  const detections = [];

  for (let candidate = 0; candidate < output.candidates; candidate++) {
    let classId = -1;
    let score = -Infinity;
    for (let index = 0; index < LABELS.length; index++) {
      const value = output.get(candidate, index + 4);
      if (value > score) {
        score = value;
        classId = index;
      }
    }
    const label = LABELS[classId];
    if (score < confidence || !EXPLICIT_CLASSES.has(label)) continue;

    const centerX = output.get(candidate, 0) * input.maxSide / MODEL_SIZE;
    const centerY = output.get(candidate, 1) * input.maxSide / MODEL_SIZE;
    const rawWidth = output.get(candidate, 2) * input.maxSide / MODEL_SIZE;
    const rawHeight = output.get(candidate, 3) * input.maxSide / MODEL_SIZE;
    const x = Math.max(0, Math.min(input.size.width, centerX - rawWidth / 2));
    const y = Math.max(0, Math.min(input.size.height, centerY - rawHeight / 2));
    const w = Math.max(0, Math.min(rawWidth, input.size.width - x));
    const h = Math.max(0, Math.min(rawHeight, input.size.height - y));
    if (w < 2 || h < 2) continue;
    detections.push({ x, y, w, h, score, label });
  }

  return suppressOverlaps(detections, nmsThreshold).slice(0, 16);
}

async function detectExplicitRegions(image, options = {}) {
  const confidence = Math.min(0.9, Math.max(0.1, Number(options.confidence) || 0.35));
  const nmsThreshold = Math.min(0.9, Math.max(0.1, Number(options.iou) || 0.45));
  const { session, modelPath } = await getSession(options.modelPath);
  const input = prepareInput(image);
  const started = performance.now();
  const results = await session.run({ [session.inputNames[0]]: input.tensor });
  const inferenceMs = performance.now() - started;
  const output = results[session.outputNames[0]];
  const regions = parseDetections(output, input, confidence, nmsThreshold).map((region) => ({
    x: Math.round(region.x),
    y: Math.round(region.y),
    w: Math.round(region.w),
    h: Math.round(region.h),
    score: Number(region.score.toFixed(4)),
    label: region.label,
  }));
  return { regions, inferenceMs, modelPath, frameSize: input.size };
}

function resetModel() {
  sessionPromise = null;
  loadedModelPath = '';
}

module.exports = { detectExplicitRegions, resetModel, EXPLICIT_CLASSES };
