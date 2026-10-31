# AI regional censor beta

## Status

Step 2 integrates the local ONNX detector into the real Electron screen-censor
loop. The model and ONNX Runtime are bundled in the Windows test installer. The
project, packaged model, and NudeNet integration are published as AGPL-3.0
corresponding source.

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
3. Packaged `resources/models/nudenet-320n.onnx`.
4. Versioned development `models/nudenet-320n.onnx`.
5. Legacy development `test/models/nudenet-320n.onnx`.

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
- The Windows NSIS installer includes the model under `resources/models/`.
- ONNX Runtime native libraries are unpacked from ASAR for Windows loading.
- Version 1.2.0 installer: 107,706,546 bytes (102.72 MiB).
- Packaged Windows x64 runtime: 61.48 MiB; unused macOS, Linux, and ARM64
  binaries are excluded.
- Packaged runtime smoke test loaded input `images` and output `output0` from
  the versioned model successfully.

## Version 1.2.1 regional coverage hotfix

- Explicit-region padding is class-aware instead of a fixed 8% margin:
  exposed breasts receive 30% horizontal and 25% vertical padding, explicit
  genital/anus regions receive 24%, and exposed buttocks receive 18%.
- Every class also has a minimum pixel margin so small detections do not leave
  exposed edges.
- A high-confidence exposed-breast detection can recover a geometrically
  related companion detection down to the secondary confidence floor. This
  avoids lowering the global threshold and limits additional false positives.
- Stable regions survive three missed inference frames instead of one to avoid
  brief exposure from detector flicker.
- The censor remains regional; no full-screen fallback was enabled.
- Windows x64 installer: 107,706,810 bytes (102.72 MiB), SHA-256
  `EAF0C1766C6E7107DD48036163D0C2A1639C3623111E6CD269019CD73A80E56A`.

## Remaining gates

- Measure the final installer/runtime footprint and benchmark a smaller
  WebAssembly or DirectML packaging option if distribution size is excessive.
- Test end-to-end CPU and memory on representative target PCs and multiple
  monitors.
- Build a consented validation set and measure false positives/negatives.
- Add live dashboard telemetry and per-class controls during the dashboard
  redesign.
