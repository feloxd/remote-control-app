# AI regional censor beta

## Status

Step 2 integrates the local ONNX detector into the real Electron screen-censor
loop. It remains a development beta: the model and ONNX runtime are not bundled
in the production installer until the public corresponding-source URL and
release packaging are complete. The project and NudeNet are treated as
AGPL-3.0-covered works.

When the AI runtime or model is unavailable, the client can either use the
legacy skin-color detector or leave the screen unchanged. Full-screen fallback
is disabled by the dashboard.

## Runtime pipeline

1. Electron captures each connected display locally.
2. The frame is letterboxed and resized to 320x320 RGB.
3. NudeNet ONNX returns candidate body-part boxes.
4. Only explicit exposed classes are retained.
5. Non-maximum suppression removes overlapping boxes.
6. Boxes are padded by 8%, mapped back to display coordinates, and smoothed
   against the prior frame.
7. A transparent, click-through Electron overlay pixelates only those boxes.

The configured explicit classes are exposed buttocks, exposed female breast,
exposed female or male genitalia, and exposed anus. Face, belly, armpit, feet,
covered body-part, and male-breast labels are not censored.

## Dashboard payload

`censor_screen` accepts:

```json
{
  "enabled": true,
  "engine": "ai",
  "confidence": 0.35,
  "intensity": "medium",
  "fps": 5,
  "fallbackEngine": "skin",
  "fallback": false
}
```

- `confidence`: clamped to 0.15-0.85.
- `fps`: normalized to 3, 5, or 7.
- `fallbackEngine`: `skin` or `none`.
- `fallback`: legacy API field; the dashboard always sends `false` so no
  automatic full-screen censor is applied.

## Local development

The detector looks for the model in this order:

1. Explicit `modelPath` in the action payload.
2. `CENSOR_MODEL_PATH` environment variable.
3. Packaged `resources/models/nudenet-320n.onnx` (reserved for a future
   AGPL-compliant source release).
4. Development `test/models/nudenet-320n.onnx`.

Useful checks:

```powershell
npm.cmd run test:censor-detector --workspace=@remote-control/desktop-client -- "C:\path\image.jpg" 0.35
npm.cmd run test:censor-live --workspace=@remote-control/desktop-client
```

## Step 2 verification

- Safe dashboard reference: 0 explicit regions.
- Positive controlled sample at 35% confidence: 3 explicit regions; face and
  abdomen excluded.
- Production detector inference: 18.73-21.62 ms on CPU in isolated tests.
- Real desktop capture + overlay smoke test: 15.49 ms inference, clean start
  and stop.
- Dashboard production build: passed.
- Windows NSIS client build: passed; installer size 77,282,630 bytes.
- Packaged ASAR contains the integration code but excludes the ONNX model and
  runtime, so the current installer safely uses the configured fallback.

## Remaining gates

- Publish the exact corresponding source and model revision under AGPL-3.0.
- Decide whether the roughly 258 MiB unpacked native runtime is acceptable or
  benchmark a smaller WebAssembly/DirectML packaging option.
- Test end-to-end CPU and memory on representative target PCs and multiple
  monitors.
- Build a consented validation set and measure false positives/negatives.
- Add live dashboard telemetry and per-class controls during the dashboard
  redesign.
