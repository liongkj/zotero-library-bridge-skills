---
name: zotero-external-search-import
description: Use an OpenAlex-first discovery workflow to find papers, normalize metadata, deduplicate records, and orchestrate Zotero import/full-text handoff. Use this whenever the user asks to find papers, look up DOIs, gather recent publications, or prepare bibliography data, even if they do not explicitly mention Zotero or "import".
---

# Zotero External Search Import

Use OpenAlex as the default discovery backend, normalize records into the Zotero import schema, and orchestrate the downstream import/full-text/TL;DR flow.

## What this skill does

- Discover papers through OpenAlex first.
- Normalize records into one schema.
- Deduplicate records before import.
- Return import-ready results and a short confidence note.
- Delegate import and post-import work to companion Zotero skills.

## Read first

- For the OpenAlex field contract and ranking defaults, read [references/openalex.md](references/openalex.md).
- If execution support is useful, use [scripts/openalex_works.py](scripts/openalex_works.py) as the narrow OpenAlex lookup helper.

## Named phases

1. `discover`
   - Query OpenAlex first for topic search, title lookup, and DOI resolution.
   - Apply year filters and result limits from the user request.
2. `normalize`
   - Convert OpenAlex results into the canonical intermediate shape from `references/openalex.md`.
   - Map that shape into the Zotero record schema without inventing missing fields.
3. `dedupe`
   - Deduplicate by DOI first, then normalized title + year.
4. `rank`
   - Rank by title/keyword match, abstract relevance, year constraints, and metadata completeness.
   - Prefer DOI-present records over DOI-missing records when relevance is otherwise similar.
5. `import`
   - If the user asked to import, pass the normalized records to `zotero-library-bridge`.
6. `retrieve_full_text`
   - Unless the user explicitly asked for metadata-only import, request `fetch_full_text=true` when DOI or OA/full-text hints are present.
7. `summarize`
   - If the user asked for TL;DRs, triage, or citation notes, hand off to `zotero-reading-classifier` after import/full-text retrieval.
8. `report`
   - Return per-item import status, Zotero `item_id` keys, and full-text retrieval outcomes.

## Default flow and stopping points

- Discovery only:
  - stop after `rank`
  - return ranked records plus confidence note
- Discovery + import:
  - stop after `import`
  - call the bridge import endpoint or `import_items`
- Discovery + import + readable library item:
  - stop after `retrieve_full_text`
  - import then queue full-text retrieval
- Discovery + import + TL;DR:
  - complete all phases
  - use `zotero-reading-classifier` for the summary step

## Ambiguity guardrails

- Do not treat "import to Zotero" as "metadata only" unless the user says so.
- If the bridge import succeeds, report whether full-text retrieval was also queued.
- If summarization was requested, say explicitly that the summarize step is a second phase after import.
- Treat OpenAlex as the default source, not the only possible source.
- Use non-OpenAlex fallback only when OpenAlex misses a known item, metadata remains incomplete, or the request is source-specific (`PMCID`, `arXiv`, repository-only).

## Composition contract

- `zotero-external-search-import`
  - owns discovery, normalization, deduplication, ranking, and orchestration
- `zotero-library-bridge`
  - owns Zotero import, search, attachments, and full-text retrieval
- `zotero-reading-classifier`
  - owns TL;DRs, triage, and citation-use notes

## Bridge handoff contract

When handing records to `zotero-library-bridge`:

1. Normalize first, then dedupe.
2. Resolve bridge behavior from `GET /v1/capabilities` before import.
3. Map records directly to `import_items(records)` payload.
4. Use small batches for imports (recommended 10-20 records/request).
5. Return imported Zotero `item_id` values in deterministic order.
6. For full text, call `find_full_text(item_ids)` in chunks of 5-10.

Required minimal fields per record:

```json
{
  "title": "string",
  "authors": ["string"],
  "journal": "string or null",
  "year": 2026,
  "doi": "string or null",
  "url": "string"
}
```

Recommended optional fields:

- `abstract`
- `pdf_url`
- `keywords`
- `source`

## Bridge availability fallback

If bridge is unavailable or misconfigured:

1. Return import-ready JSON without mutating Zotero.
2. Provide these verification commands:
   - `curl -sS -i "http://127.0.0.1:23130/v1/health"`
   - `curl -sS -i "http://127.0.0.1:23130/v1/capabilities"`
3. Explain likely cause (`connection refused`, `route not found`, token mismatch).
4. Provide a single retry import command once health is restored.

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
