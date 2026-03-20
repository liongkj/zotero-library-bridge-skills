# Zotero Library Bridge

Local Zotero desktop add-on that exposes a localhost-only HTTP bridge for LLM workflows.

## What it provides

- Local bridge server bound to `127.0.0.1`
- Import/search/organize Zotero items
- Attachments listing and attachment text extraction
- Notes, tags, collection placement
- Citation and bibliography formatting

## Security model

- Server is intentionally localhost-only.
- No external binding and no reverse proxy support.
- Current mode does not require a token header because requests are accepted only from local loopback.

## API endpoints

- `GET /v1/health`
- `POST /v1/import-items`
- `GET /v1/items?q=<query>&limit=<n>`
- `GET /v1/items/:itemKey/attachments`
- `GET /v1/attachments/:attachmentKey/text`
- `POST /v1/find-full-text`
- `POST /v1/items/:itemKey/tags`
- `POST /v1/items/:itemKey/move-collection`
- `POST /v1/items/:itemKey/notes`
- `POST /v1/format/citation`
- `POST /v1/format/bibliography`

## Build

```bash
pnpm install
pnpm run build-dev
```

Built package:

- `build/zotero-library-bridge.xpi`

## Install in Zotero

1. Open Zotero -> Tools -> Plugins.
2. Click gear icon -> Install Add-on From File.
3. Select `build/zotero-library-bridge.xpi`.
4. Restart Zotero.

## Quick smoke test

```bash
curl -sS -i "http://127.0.0.1:23130/v1/health"
curl -sS -G --data-urlencode "q=attention" --data-urlencode "limit=5" "http://127.0.0.1:23130/v1/items"
```

## Skill files

Recommended companion skills are under:

- `skills/zotero-external-search-import`
- `skills/zotero-library-bridge`
- `skills/zotero-reading-classifier`
