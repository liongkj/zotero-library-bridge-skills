---
name: open-access-mining-guide
description: Build repeatable open-access full-text mining pipelines (discovery, retrieval, parsing, extraction, and QA) and feed structured outputs back into Zotero-centered evidence workflows. Use this whenever a user asks to mine many papers for entities, outcomes, or section-level data.
---

# Open Access Mining Guide

Scale from single-paper reading to reproducible corpus-level extraction while staying inside legal and licensing boundaries.

## Scope

- Repository-first mining (for example `PMC`, `Europe PMC`, `CORE`, `arXiv`).
- Structured parsing from XML/LaTeX/plain text into machine-usable records.
- Section-aware extraction (methods/results/discussion) for synthesis tasks.
- Provenance capture so mined findings remain traceable to source papers.

## Pipeline blueprint

1. Define corpus query and inclusion criteria.
2. Retrieve OA full text with stable identifiers (`DOI`, `PMCID`, `arXiv ID`).
3. Parse into normalized fields (metadata, sections, references).
4. Extract target signals (entities, numeric outcomes, citations, claims).
5. Run QA on a sampled subset and log extraction error patterns.
6. Export structured outputs and link results back to Zotero items/notes.

## Minimum data model

```json
{
  "paper_id": "doi|pmcid|arxiv",
  "source": "pmc|core|arxiv|other",
  "license": "string or null",
  "sections": [
    {"title": "Methods", "text": "..."}
  ],
  "entities": [
    {"text": "string", "type": "string"}
  ],
  "numeric_findings": ["string"],
  "provenance": {
    "retrieved_at": "ISO-8601",
    "source_url": "string"
  }
}
```

## Legal and operational guardrails

- Mine only content with lawful access and record license status per paper.
- Respect API/rate limits; cache raw responses to avoid repeated downloads.
- Share derived data when uncertain about redistribution rights for full text.
- Keep a validation report (sample size, precision issues, unresolved ambiguities).

## Zotero integration pattern

- Store corpus query protocol as a Zotero note.
- Attach per-paper extraction summaries to source items.
- Tag items with mining stage (`retrieved`, `parsed`, `qa-passed`, `needs-review`).
- Generate a final collection-level synthesis note with method and limitations.
