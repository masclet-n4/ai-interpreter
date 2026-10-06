# document-interpreter

Servicio Bun que descarga texto OCR desde una URL firmada de RustFS, solicita una salida estructurada a OpenRouter y la valida con AJV.

## API interna

- `GET /alive` — healthcheck.
- `POST /validate-schema` — `{ "schema": ... }`; compila el schema con AJV antes de iniciar OCR.
- `POST /interpret` — `{ "text_url": "...", "schema": ... }`; devuelve `{ "result": ... }`.

`text_url` debe tener el mismo origen que `RUSTFS_ENDPOINT`. La API acepta schemas JSON compatibles con AJV y el proveedor seleccionado; no limita keywords mediante una allowlist propia.

## Desarrollo

```sh
bun install
cp .env.example .env
# Edita OPENROUTER_API_KEY y RUSTFS_ENDPOINT
bun run dev
bun test
```

Variables: `PORT` (3002), `RUSTFS_ENDPOINT`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` (por defecto `openai/gpt-5-nano`), `OPENROUTER_MAX_TOKENS` (4096) e `INTERPRETER_MAX_TEXT_BYTES` (524288). Bun carga `.env` automáticamente; no guardes credenciales reales en `.env.example`.
