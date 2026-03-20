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
6. If the user asked to import, pass the records to `zotero-library-bridge`.
7. Unless the user explicitly asked for metadata-only import, request `fetch_full_text=true` when DOI or `pdf_url` is available.
8. If the user asks for TL;DRs, triage, citation notes, or manuscript guidance, hand off to `zotero-reading-classifier` after import.

## Default handoff rules

- Discovery only:
  - return ranked records plus confidence note
- Discovery + import:
  - call the bridge import endpoint or `import_items`
- Discovery + import + readable library item:
  - import
  - queue full-text retrieval
- Discovery + import + TL;DR:
  - import
  - queue full-text retrieval
  - then use `zotero-reading-classifier`

## Ambiguity guardrails

- Do not treat "import to Zotero" as "metadata only" unless the user says so.
- If the bridge import succeeds, report whether full-text retrieval was also queued.
- If summarization was requested, say explicitly that the summarize step is a second phase after import.

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
