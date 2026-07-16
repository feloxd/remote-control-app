const { app } = require('electron');
const overlay = require('../src/main/actions/overlay');

async function run() {
  const stats = await overlay.censorScreen({
    enabled: true,
    engine: 'ai',
    confidence: 0.35,
    intensity: 'medium',
    fps: 3,
    fallbackEngine: 'none',
    fallback: false,
  });
  console.log(`AI censor live smoke started: ${JSON.stringify(stats)}`);
  await new Promise((resolve) => setTimeout(resolve, 1500));
  await overlay.censorScreen({ enabled: false });
  overlay.clearTopEffects();
  console.log('AI censor live smoke stopped cleanly');
}

app.whenReady()
  .then(run)
  .catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  })
  .finally(() => app.quit());
