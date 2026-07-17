const assert = require('assert');
const { app } = require('electron');
const detector = require('../src/main/actions/aiCensorDetector');
const overlay = require('../src/main/actions/overlay');

function region(overrides = {}) {
  return {
    x: 100,
    y: 100,
    w: 100,
    h: 80,
    score: 0.5,
    label: 'FEMALE_BREAST_EXPOSED',
    ...overrides,
  };
}

function run() {
  const strong = region();
  const relatedWeak = region({ x: 330, score: 0.22 });
  const unrelatedWeak = region({ x: 800, y: 600, score: 0.24 });
  const selected = detector.__test.selectExplicitDetections(
    [strong, relatedWeak, unrelatedWeak],
    0.35,
    0.18,
  );
  assert.strictEqual(selected.length, 2, 'related low-confidence breast should be recovered');
  assert(selected.includes(relatedWeak), 'related companion detection was not retained');
  assert(!selected.includes(unrelatedWeak), 'unrelated low-confidence detection was retained');

  const bounds = { width: 1000, height: 800 };
  const paddedBreast = overlay.__test.padRegion(strong, bounds);
  assert.deepStrictEqual(
    { x: paddedBreast.x, y: paddedBreast.y, w: paddedBreast.w, h: paddedBreast.h },
    { x: 70, y: 80, w: 160, h: 120 },
    'breast region should receive class-specific adaptive padding',
  );

  const genital = region({ label: 'FEMALE_GENITALIA_EXPOSED', w: 40, h: 50 });
  const paddedGenital = overlay.__test.padRegion(genital, bounds);
  assert.deepStrictEqual(
    { x: paddedGenital.x, y: paddedGenital.y, w: paddedGenital.w, h: paddedGenital.h },
    { x: 84, y: 84, w: 72, h: 82 },
    'small genital region should receive the minimum safe padding',
  );

  overlay.__test.resetCensorTracks();
  assert.strictEqual(overlay.__test.stabilizeCensorRegions('test', [strong]).length, 1);
  for (let miss = 0; miss < overlay.__test.MAX_CENSOR_MISSES; miss++) {
    assert.strictEqual(
      overlay.__test.stabilizeCensorRegions('test', []).length,
      1,
      `region should survive missed frame ${miss + 1}`,
    );
  }
  assert.strictEqual(
    overlay.__test.stabilizeCensorRegions('test', []).length,
    0,
    'region should expire after the configured missed-frame window',
  );
  overlay.__test.resetCensorTracks();
  console.log('AI censor regional policy tests passed');
}

app.whenReady()
  .then(run)
  .then(() => app.quit())
  .catch((error) => {
    console.error(error.stack || error.message);
    app.exit(1);
  });
