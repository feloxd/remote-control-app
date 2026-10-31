# Remote Control App

Monorepo Node.js con npm workspaces para controlar remotamente dispositivos de destino.

> Proyecto publicado bajo GNU AGPL-3.0. Consulta [LICENSE](LICENSE),
> [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) y la
> [lista de publicación](docs/PUBLICATION_CHECKLIST.md).

## Estructura

```
remote-control-app/
├── apps/                  # Aplicaciones (controller, target, etc.)
├── packages/
│   └── shared/            # Acciones y utilidades compartidas
├── package.json
└── .gitignore
```

## Acciones disponibles (`ACTIONS`)

| Acción            | Descripción                        |
|-------------------|------------------------------------|
| `open_url`        | Abrir una URL en el navegador      |
| `show_image`      | Mostrar una imagen                 |
| `play_video`      | Reproducir un video                |
| `play_audio`      | Reproducir audio                   |
| `show_overlay`    | Mostrar overlay en pantalla        |
| `hide_overlay`    | Ocultar overlay                    |
| `lock_keyboard`   | Bloquear el teclado                |
| `unlock_keyboard` | Desbloquear el teclado             |
| `lock_screen`     | Bloquear la pantalla               |
| `unlock_screen`   | Desbloquear la pantalla            |
| `take_screenshot` | Capturar pantalla                  |
| `filter_sites`    | Filtrar sitios web                 |
| `clear_filters`   | Limpiar filtros                    |

## Instalación

```bash
npm install
```

El servidor requiere configuración explícita. Copia `.env.example` a `.env`,
reemplaza todos los valores de ejemplo y utiliza HTTPS/WSS antes de exponerlo a
Internet. No existen credenciales predeterminadas.

## Uso

```js
const { ACTIONS } = require('@remote-control/shared/actions');
```

## Dashboard y cliente Windows

El dashboard incluye controles con estado, preferencias persistentes del
censor y transferencias de archivos de hasta 25 MB hacia la carpeta autorizada
`Descargas\Remote Control Files` del cliente. Los archivos se transmiten en
fragmentos mediante Socket.IO y no se almacenan en el servidor.

El instalador Windows x64 1.2.0 incluye NudeNet 320n y ONNX Runtime para ejecutar
la detección regional de contenido explícito localmente en el equipo cliente.

## Código fuente

El dashboard y el cliente muestran un enlace a `/source`. En despliegues
públicos, `SOURCE_CODE_URL` debe apuntar al código correspondiente de la versión
en ejecución, conforme a GNU AGPL-3.0.
