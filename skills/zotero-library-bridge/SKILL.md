---
name: zotero-library-bridge
description: Operate a local Zotero library through the Zotero JavaScript API using a plugin bridge for import, full-text retrieval, metadata reads, tags, collections, notes, and citation formatting. Use this whenever the user wants to read or modify their Zotero library contents, especially attachment text and library organization tasks.
---

# Zotero Library Bridge

Bridge LLM workflows to the local Zotero desktop library through plugin-level JavaScript API actions.

## Action contract

```text
import_items(records)
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
