---
name: zotero-library-bridge
description: Operate a local Zotero library through the Zotero JavaScript API using a plugin bridge for import, full-text retrieval, metadata reads, tags, collections, notes, and citation formatting. Use this whenever the user wants to read or modify their Zotero library contents, especially attachment text and library organization tasks.
---

# Zotero Library Bridge

Bridge LLM workflows to the local Zotero desktop library through plugin-level JavaScript API actions.

## First-run verification

1. Install the XPI into Zotero and restart Zotero.
2. Confirm the local bridge is listening on `127.0.0.1:23130`.
3. Verify `GET /v1/health`.
4. Read `GET /v1/capabilities` to confirm supported actions and defaults.
5. Run a smoke-test query with `GET /v1/items?q=test&limit=1`.

## Action contract

```text
import_items(records, fetch_full_text?)
find_full_text(item_ids)
get_items(query)
get_attachments(item_id)
get_attachment_text(item_id)
add_tags(item_id, tags)
move_to_collection(item_id, collection_path)
create_note(item_id, note_text)
format_citation(item_ids, style)
format_bibliography(item_ids, style)
```

## HTTP routes

```text
GET /v1/health
GET /v1/capabilities
POST /v1/import-items
POST /v1/find-full-text
GET /v1/items?q=<query>&limit=<n>
GET /v1/items/:itemKey/attachments
GET /v1/attachments/:attachmentKey/text
POST /v1/items/:itemKey/tags
POST /v1/items/:itemKey/move-collection
POST /v1/items/:itemKey/notes
POST /v1/format/citation
POST /v1/format/bibliography
```

## Common sequences

- Import metadata only:
  - call `import_items(records)`
- Import and queue full-text retrieval:
  - call `import_items(records, fetch_full_text=true)`
- OpenAlex-first discovery pipeline:
  - let `zotero-external-search-import` discover and normalize records
  - import with `fetch_full_text=true` unless the user asked for metadata-only
- Summarize or make TL;DR notes:
  - import first
  - fetch full text if attachments are missing
  - then use `zotero-reading-classifier`

## Workflow boundaries

- This bridge mutates and reads the Zotero library.
- It does not search the web for papers; use `zotero-external-search-import` for OpenAlex-first discovery and orchestration.
- It does not generate TL;DRs or citation-use notes on its own; use `zotero-reading-classifier` after import.

## Security baseline

- Keep bridge binding on `127.0.0.1` and do not expose externally.
- Do not add external network bindings or reverse proxies for this bridge.
- Surface a clear warning if a user asks to expose the bridge beyond localhost.

## Output format

```json
{
  "action": "string",
  "status": "ok|partial|error",
  "summary": "short human-readable summary",
  "results": [
    {
      "item_id": "string",
      "status": "ok|skipped|error",
      "details": "string"
    }
  ],
  "errors": ["string"]
}
```
