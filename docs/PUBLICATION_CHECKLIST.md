# AGPL publication and release checklist

Use this checklist before distributing an installer or operating a public
service based on this repository.

## Required release inputs

- Set a real `SOURCE_CODE_URL` pointing to the public repository or source
  archive for the exact deployed version.
- Tag the exact source revision used to build the dashboard, server, and
  Windows client.
- Publish the matching `package-lock.json`, build scripts, native-addon source,
  model weights, model attribution, and installation instructions.
- Keep `LICENSE` and `THIRD_PARTY_NOTICES.md` in the source distribution.
- Include a complete third-party license inventory in release artifacts.

## Secrets and runtime data

- Never commit `.env`, `config.json`, private keys, passwords, JWT secrets, or
  production databases.
- Rotate any credential that has ever appeared in source code or chat/log
  output.
- Generate a unique password hash and JWT secret for each deployment.
- Inspect staged files before every commit with `git diff --cached`.

## Source offer

The server exposes `/source`, which redirects to `SOURCE_CODE_URL`. Both the
dashboard and Electron client display a prominent "Código fuente y licencias ·
AGPL-3.0" link to that endpoint.

Do not release while `/source` returns HTTP 503. The configured URL must remain
available for the deployed version and must provide the corresponding source,
not merely the newest development branch.

## Reproducible build

```powershell
npm.cmd install
npm.cmd run build --workspace=@remote-control/dashboard
npm.cmd run build:client
```

The AI-enabled Windows x64 release includes the approved ONNX model under
`resources/models/` and the matching ONNX Runtime Windows x64 libraries. Other
operating-system and architecture binaries are excluded from this installer.

## Verification

- Run dashboard and Windows client builds.
- Smoke-test login, session creation, Socket.IO connection, source-code link,
  AI inference, file transfer, and cleanup on disconnect.
- Run `npm audit` and document accepted residual findings.
- Confirm no database, `.env`, private key, test image, or temporary model is
  staged.
- Confirm the installer version matches the published source tag.
