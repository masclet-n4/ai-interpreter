# ai-interpreter

Servicio Bun que descarga texto OCR desde una URL firmada de RustFS, solicita una salida estructurada a OpenRouter y valida el JSON resultante con AJV.

## Requisitos

- Bun 1.3.14 o compatible.
- Un endpoint RustFS accesible por el servicio.
- Una clave de OpenRouter para interpretar documentos.

## Configuración

Bun carga `.env` automáticamente. Crea el archivo y configura las variables:

```sh
cp .env.example .env
```

| Variable | Valor en `.env.example` / defecto | Uso |
|---|---|---|
| `PORT` | `3002` | Puerto HTTP; defecto del servicio. |
| `RUSTFS_ENDPOINT` | `http://localhost:9000` | Origen permitido para descargar el texto OCR. Debe coincidir con el origen de `text_url`. Obligatorio. |
| `OPENROUTER_API_KEY` | Vacío | Credencial obligatoria para solicitar la interpretación. |
| `OPENROUTER_MODEL` | `openai/gpt-5-nano` | Modelo solicitado a OpenRouter. |
| `OPENROUTER_MAX_TOKENS` | `4096` | Límite de tokens de la respuesta. |
| `INTERPRETER_MAX_TEXT_BYTES` | `524288` | Tamaño máximo del texto descargado desde RustFS. |

En el workspace, Compose configura `RUSTFS_ENDPOINT` para la red de contenedores. No uses `localhost` ahí si RustFS está en el host.

## Ejecución

Desde este directorio:

```sh
bun install
bun run dev
```

El servicio escucha en <http://localhost:3002>. Para ejecutarlo sin modo watch, usa `bun run start`. En el workspace, se inicia con `docker compose` desde el directorio raíz.

## API

- `GET /alive` — healthcheck.
- `POST /validate-schema` — recibe `{ "schema": ... }` y comprueba el JSON Schema.
- `POST /interpret` — recibe `{ "text_url": "...", "schema": ... }` y devuelve `{ "result": ... }`.

`text_url` debe tener el mismo origen que `RUSTFS_ENDPOINT`. Se aceptan schemas JSON compatibles con AJV y con el proveedor de OpenRouter.

## Pruebas

```sh
bun test
```

No guardes claves reales en `.env.example` ni en el repositorio.
