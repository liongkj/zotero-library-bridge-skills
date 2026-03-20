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
- `GET /v1/capabilities`
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
curl -sS "http://127.0.0.1:23130/v1/capabilities"
curl -sS -G --data-urlencode "q=attention" --data-urlencode "limit=5" "http://127.0.0.1:23130/v1/items"
```

Healthy startup should report the bridge host, port, and addon name from `/v1/health`.

## Import behavior

- `POST /v1/import-items` imports metadata by default.
- To queue Zotero's full-text lookup immediately after import, pass `"fetch_full_text": true`.
- The bridge does not generate TL;DRs or notes automatically. Use `skills/zotero-reading-classifier` after import and full-text retrieval when the user asks for summaries, triage, or citation notes.

Example:

```bash
curl -sS -X POST "http://127.0.0.1:23130/v1/import-items" \
  -H "Content-Type: application/json" \
  --data '{
    "fetch_full_text": true,
    "records": [
      {
        "title": "Example paper",
        "authors": ["Ada Lovelace"],
        "journal": "Journal of Examples",
        "year": 2026,
        "doi": "10.0000/example",
        "url": "https://doi.org/10.0000/example"
      }
    ]
  }'
```

## Skill files

Recommended companion skills are under:

- `skills/zotero-external-search-import`
- `skills/zotero-library-bridge`
- `skills/zotero-reading-classifier`

These three skills are intended to compose into one pipeline:

1. `zotero-external-search-import`
   - OpenAlex-first discovery, normalization, ranking, and orchestration
2. `zotero-library-bridge`
   - Zotero import, search, attachments, and full-text retrieval
3. `zotero-reading-classifier`
   - TL;DRs, triage, and citation-use notes after import
