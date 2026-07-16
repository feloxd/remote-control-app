const { app, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const detector = require('../src/main/actions/aiCensorDetector');

async function run() {
  const imageArg = process.argv[2];
  if (!imageArg) throw new Error('Usage: npm run test:censor-detector -- <image> [confidence]');
  const imagePath = path.resolve(imageArg);
  if (!fs.existsSync(imagePath)) throw new Error(`Image not found: ${imagePath}`);
  const image = nativeImage.createFromPath(imagePath);
  if (image.isEmpty()) throw new Error(`Could not decode image: ${imagePath}`);
  const result = await detector.detectExplicitRegions(image, {
    confidence: Number(process.argv[3]) || 0.35,
  });
  console.log(JSON.stringify({
    frameSize: result.frameSize,
    inferenceMs: Number(result.inferenceMs.toFixed(2)),
    regions: result.regions,
    model: result.modelPath,
  }, null, 2));
}

app.whenReady().then(async () => {
  try {
    await run();
    app.quit();
  } catch (error) {
    console.error(error.stack || error.message);
    app.exit(1);
  }
});
