---
name: zotero-external-search-import
description: Search external literature sources and produce clean, deduplicated, import-ready paper records for Zotero workflows. Use this whenever the user asks to find papers, look up DOIs, gather recent publications, or prepare bibliography data, even if they do not explicitly mention Zotero or "import".
---

# Zotero External Search Import

Find papers outside Zotero, normalize metadata, and return records that can be imported reliably.

## What this skill does

- Search across external sources (for example DOI providers, publisher pages, and biomedical indexes).
- Normalize records into one schema.
- Deduplicate records before import.
- Return import-ready results and a short confidence note.

## Workflow

1. Clarify objective and constraints from the prompt.
2. Search external sources and collect candidate records.
3. Normalize all candidates to the standard record schema.
4. Deduplicate by DOI first, then title-year fallback.
5. Score relevance and produce a ranked list.
6. If requested, prepare an import bundle for `zotero-library-bridge`.

## Record schema

```json
{
  "records": [
    {
      "title": "string",
      "authors": ["string"],
      "journal": "string",
      "year": 2026,
      "doi": "string or null",
      "abstract": "string or null",
      "url": "string",
      "pdf_url": "string or null",
      "keywords": ["string"],
      "source": "string",
      "relevance_score": 0.0,
      "relevance_reason": "short rationale"
    }
  ]
}
```
