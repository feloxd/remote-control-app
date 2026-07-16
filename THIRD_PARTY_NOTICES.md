# Third-party notices

Remote Control App is licensed under GNU AGPL-3.0. Third-party components keep
their respective copyrights and licenses.

## NudeNet 320n model

- Project: NudeNet by Praneeth Bedapudi / notAI-tech
- Source: <https://github.com/notAI-tech/NudeNet>
- Evaluated revision: `6ccc81c6c305cccfd46d92b414f8a5c0a816574d`
- Model path in that revision: `nudenet/320n.onnx`
- Local model SHA-256:
  `C15D8273ADAD2D0A92F014CC69AB2D6C311A06777A55545F2C4EB46F51911F0F`
- License published by the upstream project: GNU AGPL-3.0

The production release must provide the exact model weights and the
corresponding upstream source/revision alongside the source for this
application.

## ONNX Runtime

- Project: Microsoft ONNX Runtime
- Package: `onnxruntime-node@1.27.0`
- Source: <https://github.com/microsoft/onnxruntime>
- License: MIT

## Electron and npm dependencies

Electron, React, Express, Socket.IO, Vite, SQLite-related runtime components,
and the remaining npm dependency tree are third-party works. Their license
metadata and license files are retained in the corresponding installed npm
packages and must be included by the release process where required.

This notice is not a replacement for the full third-party license texts. A
release audit must generate and ship the complete license inventory for the
exact dependency lockfile used to build that release.
