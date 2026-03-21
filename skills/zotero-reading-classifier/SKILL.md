---
name: zotero-reading-classifier
description: Read Zotero metadata and available full text, classify papers by research-use tags, organize collections, and generate concise citation-use notes for manuscript writing. Use this whenever the user wants literature triage, relevance scoring, tagging, grouping, or "where to cite" support from their Zotero library.
---

# Zotero Reading Classifier

Turn imported Zotero items into citation-ready knowledge by reading, classifying, organizing, and summarizing.

Use this skill after paper discovery/import when the user wants TL;DRs, relevance triage, "where to cite", or short manuscript-ready notes.

## Default classification tags

- `radical`
- `borylation`
- `review`
- `methodology`
- `mechanism`
- `useful-introduction`
- `to-cite`

## Workflow

1. Read metadata and abstract first.
2. If full text is not yet available, call `zotero-library-bridge` full-text retrieval before proceeding.
3. Read attachment text when available.
4. Produce a short TL;DR grounded in abstract or attachment text.
5. Assign tags and confidence.
6. Choose collection path.
7. Create short note with manuscript guidance.

## Cross-skill handoff

- For web discovery, start with `zotero-external-search-import`, which owns the OpenAlex-first search and import orchestration.
- For library writes and attachment access, use `zotero-library-bridge`.
- This skill owns the summarization/TL;DR step; do not assume the bridge generates summaries automatically.

## Note template

```text
TL;DR: ...
Main contribution: ...
Most useful for: ...
Potential citation sentence: ...
Limitations: ...
Where to cite: introduction|method|mechanism|discussion
Confidence: low|medium|high
```
