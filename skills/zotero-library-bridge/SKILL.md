---
name: zotero-library-bridge
description: Operate a local Zotero library through the Zotero JavaScript API using a plugin bridge for import, full-text retrieval, metadata reads, tags, collections, notes, and citation formatting. Use this whenever the user wants to import found journal articles or citations, read or modify their Zotero library contents, especially attachment text and library organization tasks.
---

# Zotero Library Bridge

Bridge LLM workflows to the local Zotero desktop library through plugin-level JavaScript API actions.

## Install and connect runbook

Use this runbook whenever the bridge may be missing, not running, or partially working.

1. Install and enable prerequisites
   - Install Zotero desktop.
   - Install the Zotero Library Bridge XPI/addon.
   - Restart Zotero after installation.
2. Confirm listener
   - Default binding is `127.0.0.1:23130`.
3. Verify health
   - `curl -sS -i "http://127.0.0.1:23130/v1/health"`
   - Expect HTTP `200` and `{"status":"ok"}`.
4. Verify capabilities
   - `curl -sS -i "http://127.0.0.1:23130/v1/capabilities"`
   - Confirm `actions`, `routes`, `requires_token`, `host`, and `port`.
5. Verify write path with one minimal record
   - `POST /v1/import-items`.
6. Verify read path
   - `GET /v1/items?q=test&limit=1`.

If a check fails, do not guess routes. Use the troubleshooting matrix.

## Troubleshooting matrix

- `connection refused` or timeout
  - Zotero is not running, addon is disabled, or host/port is wrong.
- `Route not found`
  - Endpoint mismatch for this addon build. Re-check `GET /v1/capabilities`.
- Auth failure
  - Read `requires_token` from capabilities and send `X-Zotero-Bridge-Token` only when required.
- Import works but full text fails
  - Run `find_full_text` in smaller chunks and inspect per-item errors.
- Action listed but route unavailable
  - Return `unsupported_or_undocumented_action` and recommend addon update.

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

## Route contract (capabilities-first)

Always call `GET /v1/capabilities` first and treat it as authoritative for the current runtime.

Known routes used by current bridge builds:

```text
GET /v1/health
GET /v1/capabilities
POST /v1/import-items
POST /v1/find-full-text
GET /v1/items?q=<query>&limit=<n>
GET /v1/items/{itemKey}/attachments
GET /v1/attachments/{attachmentKey}/text
POST /v1/items/{itemKey}/tags
POST /v1/items/{itemKey}/notes
```

If an action appears in `actions` but its route is not exposed, do not brute-force endpoint discovery.

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

## Execution guidance

- Batch imports where possible (recommended 10-20 records per request).
- For long `find_full_text` jobs, use chunks of 5-10 item IDs.
- Retry transient failures once per item, then report partial failure.
- Prefer additive operations (tags, notes, collection placement).
- Avoid side effects while probing connectivity unless user explicitly asks.
- Deduplicate by DOI first, then title-year before import.

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
