# Regional AI censor proof of concept

This experiment evaluates local ONNX object detection before replacing the
existing skin-color heuristic. It is deliberately kept under `test/` and is not
included by the Electron Builder `files` configuration.

## Model

- Source: `https://github.com/notAI-tech/NudeNet/blob/v3/nudenet/320n.onnx`
- Local file: `test/models/nudenet-320n.onnx`
- Size: 12,150,158 bytes
- SHA-256: `C15D8273ADAD2D0A92F014CC69AB2D6C311A06777A55545F2C4EB46F51911F0F`
- Input: RGB float tensor `[1, 3, 320, 320]`
- Output: YOLO-style body-part boxes with 18 classes

The upstream repository publishes this model as part of an AGPL-3.0 project.
Remote Control App has adopted AGPL-3.0 and records the exact upstream revision
and model hash in `THIRD_PARTY_NOTICES.md`. This file and npm script remain
evaluation-only until the release source offer is configured.

## Run

From the repository root:

```powershell
npm.cmd run poc:censor --workspace=@remote-control/desktop-client -- --image "C:\path\to\test-image.jpg"
```

Optional flags include `--confidence 0.35`, `--runs 5`, `--pixel-size 24`,
`--padding 0.1`, and `--output <directory>`.

The command writes a regionally pixelated PNG and a JSON report to `test/out/`.
Only exposed buttocks, exposed female breast, exposed genitalia, and exposed
anus detections are censored by default. Covered body-part detections remain in
the report but are not modified in the output image.

## Exit criteria for Step 1

- The model loads in Electron on Windows x64.
- Output boxes map correctly back to the source image.
- Only configured explicit classes are pixelated.
- Warm inference time is measured over multiple runs.
- Model/runtime size and licensing risks are recorded before production use.

## Results (2026-07-14, Windows x64, CPU)

- Model load: 178-209 ms.
- Warm inference: 10.7-14.5 ms at 320x320.
- Safe dashboard reference: 0 detections and 0 modified regions.
- Positive upstream test sample: 6 detections, of which 4 configured explicit
  regions were pixelated. Face and exposed-belly boxes were reported but left
  untouched.
- Model output shape: `[1, 22, 2100]` (2,100 candidate boxes).
- Model file: 11.6 MiB.
- `onnxruntime-node@1.27.0`: about 258 MiB unpacked according to npm metadata.

The calculated FPS in the JSON report is inference-only. Continuous desktop
capture, bitmap conversion, box stabilization, multi-monitor processing, and
overlay rendering will reduce end-to-end throughput. The production target
should therefore remain an adaptive 3-7 FPS until measured in the integrated
client.

`npm audit` did not attribute any advisory to `onnxruntime-node`. Existing
advisories remain in the repository's older Electron, Electron Builder, and
Vite toolchain and should be addressed separately.

## Step 1 conclusion

Regional detection is technically viable and fast enough to proceed to an
integrated prototype. Production use is still gated on a complete corresponding
source release, end-to-end screen-loop benchmarks, runtime packaging, and
false-positive / false-negative evaluation on a representative consented test
set.
